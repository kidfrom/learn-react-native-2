import React from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "react-native/Libraries/NewAppScreen";
import { Audio } from "expo-av";
// import * as FileSystem from "expo-file-system";
import RNBluetoothClassic, {
  BluetoothDeviceReadEvent,
  BluetoothEventSubscription,
  BluetoothDevice,
} from "react-native-bluetooth-classic";

// To Do: From discussion with the owner, the react-natie-bluetooth-classic auto generate the types,
// to avoid types issue, we should use .js, and isolate the component as small as possible.
// react-native-bluetooth-classic current version: v1.60.0-rc.4"
// import BluetoothDevice from "react-native-bluetooth-classic/lib/BluetoothDevice";

export default function App() {
  let recorder = new Audio.Recording();
  let uri: string | null;

  const recorderRecord = async () => {
    const status = await recorder.getStatusAsync();
    if (status.isDoneRecording === true) {
      recorder = new Audio.Recording();
      console.log("recorderRecord(): new recorder object");
    }
    if (status.canRecord === false) {
      try {
        await recorder.prepareToRecordAsync(
          Audio.RECORDING_OPTIONS_PRESET_LOW_QUALITY
        );
        uri = recorder.getURI();
        console.log(`recorder is prepared: ${uri}`);
        await recorder.startAsync();
        console.log("recorder is recording");
      } catch (error) {
        console.error(`recorderRecord(): ${error}`);
        const status = await Audio.getPermissionsAsync();
        if (status.canAskAgain === true && status.granted === false) {
          await Audio.requestPermissionsAsync();
        }
      }
    }
  };

  /**
   * // TODO: fix Error: Cannot unload a Recording that has already been unloaded. || Error: Cannot unload a Recording that has not been prepared.
   * Steps to reproduce: Spam the 'Press to record the audio' button
   * Severity: Minor
   *
   * https://github.com/expo/expo/issues/1709
   */
  const recorderStop = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // handle Error: Stop encountered an error: recording not stopped
    const status = await recorder.getStatusAsync();
    if (status.isRecording === true) {
      try {
        await recorder.stopAndUnloadAsync();
        console.log("recorder stopped");
      } catch (error) {
        if (
          error.message.includes(
            "Stop encountered an error: recording not stopped"
          )
        ) {
          await recorder._cleanupForUnloadedRecorder({
            canRecord: false,
            durationMillis: 0,
            isRecording: false,
            isDoneRecording: false,
          });
          console.log(`recorderStop() error handler: ${error}`);
        } else if (
          error.message.includes(
            "Cannot unload a Recording that has already been unloaded."
          ) ||
          error.message.includes(
            "Cannot unload a Recording that has not been prepared."
          )
        ) {
          console.log(`recorderStop() to do error handler: ${error}`);
        } else {
          console.error(`recorderStop(): ${error}`);
        }
      }
    }
  };

  let player = new Audio.Sound();

  const playerPlay = async (uri: string) => {
    const status = await player.getStatusAsync();
    if (status.isLoaded === true) {
      await playerStop();
    }
    try {
      await player.loadAsync({
        uri,
      });
      await player.playAsync();
      console.log("player is playing");
    } catch (error) {
      if (error.message.includes("The Sound is already loading.")) {
        player = new Audio.Sound();
        console.log("new player");
        await playerPlay(uri);
      } else {
        console.error(`playerPlay(): ${error}`);
      }
    }
  };

  const playerPause = async () => {
    try {
      await player.pauseAsync();
      console.log("player paused");
    } catch (error) {
      console.error(`playerPause(): ${error}`);
    }
  };

  const playerUnpause = async () => {
    try {
      await player.playAsync();
    } catch (error) {
      console.error(`playerUnpause(): ${error}`);
    }
  };

  const playerStop = async () => {
    try {
      await player.unloadAsync();
      console.log("player unloaded");
    } catch (error) {
      console.error(`playerStop(): ${error}`);
    }
  };

  const bluetoothIsEnabled = async () => {
    try {
      const enabled = await RNBluetoothClassic.isBluetoothEnabled();
      console.log(`bluetooth is enabled: ${enabled}`);
      return enabled;
    } catch (error) {
      console.error(`bluetoothIsEnabled(): ${error}`);
      return false;
    }
  };

  const bluetoothBondedDevices = async () => {
    try {
      const list = await RNBluetoothClassic.getBondedDevices();
      console.log(list);
    } catch (error) {
      console.error(`bluetoothList(): ${error}`);
    }
  };

  const bluetoothIsConnected = async (address: string) => {
    try {
      const connected = await RNBluetoothClassic.isDeviceConnected(address);
      console.log(`bluetooth is connected: ${connected}`);
      return connected;
    } catch (error) {
      console.error(`bluetoothIsConnected(): ${error}`);
      return false;
    }
  };

  let bluetoothDeviceAddress = "00:13:04:84:03:07"; // TODO: let the user choose.
  let bluetoothDevice: BluetoothDevice;
  let bluetoothReadSubscription: BluetoothEventSubscription;

  const bluetoothConnect = async (address: string) => {
    const enabled = await bluetoothIsEnabled();
    if (enabled === true) {
      try {
        const connected = await bluetoothIsConnected(address);
        if (connected === false) {
          bluetoothDevice = await RNBluetoothClassic.connectToDevice(address, { "DELIMITER": `*${String.fromCharCode(13)}` });

          const result = await bluetoothIsConnected(address);
          if (result === true) {
            bluetoothReadSubscription = bluetoothDevice.onDataReceived((data) =>
              bluetoothOnDataReceived(data)
            );
            console.log(
              `connected to bluetooth device with address '${address}'`
            );
          }
        }
      } catch (error) {
        console.error(`bluetoothConnect(): ${error}`);
      }
    }
  };

  /**
   * // TODO: implement A2DP.
   * 
   * {13} = ASCII Char Code 13 / CR
   * {10} = ASCII Char Code 10 / LF
   * 1. C:BRGIN*{13}+GPIO=1{13}{10}
   * 2. C:END*{13}+GPIO=0{13}{10}
   * 3. C:SOS*{13}
   * 4. C:VM*{13}
   * 5. C:VP*{13}
   */
  const bluetoothOnDataReceived = (event: BluetoothDeviceReadEvent) => {
    // let charCodeArray = [];
    // for (let i = 0; i < event.data.length; i++) {
    //   charCodeArray.push(event.data.charCodeAt(i));
    // }
    // console.log(charCodeArray);
    // console.log(`
    //   C:BRGIN* ${event.data.includes(`C:BRGIN*`)} \n
    //   C:END* ${event.data.includes(`C:END*`)} \n
    //   C:SOS* ${event.data.includes(`C:SOS*`)} \n
    //   C:VM* ${event.data.includes(`C:VM*`)} \n
    //   C:VP* ${event.data.includes(`C:VP*`)}
    // `);

    if (event.data.includes("C:BRGIN*")) {
    } else if (event.data.includes("C:END*")) {
    } else if (event.data.includes("C:VM*")) {
    } else if (event.data.includes("C:VP*")) {
    } else if (event.data.includes("C:SOS*")) {
    }
  };

  React.useEffect(() => {
    console.log("re-render");
  });

  return (
    <SafeAreaView>
      <ScrollView style={styles.scrollView}>
        <View style={styles.body}>
          <View style={styles.sectionContainer}>
            <Pressable
              onPressIn={() => recorderRecord()}
              onPressOut={() => recorderStop()}
            >
              <Text>Press to record the audio</Text>
            </Pressable>
          </View>
          <View style={styles.sectionContainer}>
            <Pressable
              onPress={() => {
                if (uri !== null) {
                  playerPlay(uri);
                }
              }}
            >
              <Text>Play the audio</Text>
            </Pressable>
          </View>
          <View style={styles.sectionContainer}>
            <Pressable onPress={() => playerPause()}>
              <Text>Pause the audio</Text>
            </Pressable>
          </View>
          <View style={styles.sectionContainer}>
            <Pressable onPress={() => playerUnpause()}>
              <Text>Unpause the audio</Text>
            </Pressable>
          </View>
          <View style={styles.sectionContainer}>
            <Pressable onPress={() => bluetoothBondedDevices()}>
              <Text>Bluetooth List</Text>
            </Pressable>
          </View>
          <View style={styles.sectionContainer}>
            <Pressable
              onPress={() => {
                if (bluetoothDeviceAddress !== null) {
                  bluetoothConnect(bluetoothDeviceAddress);
                }
              }}
            >
              <Text>Bluetooth Connect</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: Colors.lighter,
  },
  body: {
    backgroundColor: Colors.white,
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
});
