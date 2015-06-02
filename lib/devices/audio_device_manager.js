import Debug from 'debug';
import fs from 'fs';

let debug = Debug('taskcluster-docker-worker:devices:audioManager');

const BASE_DIR = '/dev/snd';

export default class AudioDeviceManager {
  constructor() {
    this.devices = this.buildDeviceList();
  }

  buildDeviceList() {
    let deviceList = [];
    let deviceFiles;
    try {
      deviceFiles = fs.readdirSync(BASE_DIR)
                        .filter((deviceFile) => {
                          return /^controlC[0-9]+$/.test(deviceFile);
                        });
    }
    catch (e) {
      debug(`Caught error when gathering audio devices. ${e}`);
      return [];
    }

    deviceFiles.forEach((deviceFile) => {
      try {
        deviceList.push(new AudioDevice(`${BASE_DIR}/${deviceFile}`));
      }
      catch(e) {
        debug(`Error creating audio device. Error: ${e}`);
      }
    });

    debug(`
      List of ${deviceList.length} audio devices created.
      Devices: ${JSON.stringify(deviceList, null, 2)}
    `);

    return deviceList;
  }

  getAvailableDevice() {
    debug('Aquiring available device');
    for (let device of this.devices) {
      if (device.active) continue;
      device.aquire();
      debug(`Device: ${device.path} aquired`);
      return device;
    }

    throw new Error(`
      Fatal error... Could not aquire audio device:

      ${JSON.stringify(this.devices)}
    `);
  }
}

class AudioDevice {
  constructor(path, active=false) {
    this.path = path;
    this.active = active;
    let deviceId = path.match(/^\/dev\/snd\/controlC([0-9]+)$/);

    if (!deviceId) throw new Error('Path does not appear to be a valid audio device file');

    deviceId = deviceId[1];
    this.mountPoints = [
      `/dev/snd/controlC${deviceId}`,
      `/dev/snd/pcmC${deviceId}D0c`,
      `/dev/snd/pcmC${deviceId}D0p`,
      `/dev/snd/pcmC${deviceId}D1c`,
      `/dev/snd/pcmC${deviceId}D1p`,
    ];
  }

  aquire() {
    if (this.active) throw new Error('Device has already been aquired');
    this.active = true;
  }

  release() {
    debug(`Device: ${this.path} released`);
    this.active = false;
  }

}