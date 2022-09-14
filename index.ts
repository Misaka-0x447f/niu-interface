import got, {Response} from 'got';
import * as crypto from 'crypto';
import FormData from 'form-data';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let token;
let username;
let password;

const tokenClient = got.extend({
  prefixUrl: 'https://account.niu.com',
  hooks: {
    beforeError: [
      err => {
        // eslint-disable-next-line no-console
        console.error(`${err.request?.requestUrl}: ${err.response?.body}`);
        return err;
      },
    ],
  },
});

export const updateLoginInfo = (p: {username: string; password: string}) => {
  username = p.username;
  password = p.password;
  updateToken().then();
};

export const updateToken = () => {
  if (!username) {
    return;
  }
  const body = new FormData();
  body.append('account', username);
  body.append('password', crypto.createHash('md5').update(password).digest('hex'));
  body.append('grant_type', 'password');
  body.append('scope', 'base');
  body.append('app_id', 'niu_03cn0n7v');
  return tokenClient.post('v3/api/oauth2/token', {
    body,
  }).json<any>().then((el) => {
    const res = el?.data?.token?.access_token;
    if (res) {
      token = res;
      return;
    }
    throw new Error(`Error: cannot fetch token with message: ${JSON.stringify(el)}`);
  });
};

const apiClient = got.extend({
  prefixUrl: 'https://app-api.niu.com',
  headers: {
    'user-agent': 'manager/4.8.0 (iPhone; iOS 15.5; Scale/2.00);deviceName=iPhone;' +
      'timezone=Asia/Shanghai;ostype=iOS;model=iPhone12,8;lang=en-US;clientIdentifier=Domestic',
  },
  hooks: {
    beforeRequest: [
      async options => {
        if (!token) {
          await updateToken();
        }
        options.headers['token'] = token;
      },
    ],
    afterResponse: [
      async (response: Response<any>, retryWithMergedOptions) => {
        if (response.body?.status === 20021) {
          // eslint-disable-next-line no-console
          console.error('Server refused to login due to rate limit. Retry in 60 seconds.');
          await sleep(60000);
          await updateToken();
        }
        if (response.body?.status === 1131) {
          await updateToken();
        }
        return retryWithMergedOptions({
          headers: {
            token,
          },
        });
      },
    ],
    beforeError: [
      err => {
        // eslint-disable-next-line no-console
        console.error(`${err.request?.requestUrl}: ${err.response?.body}`);
        return err;
      },
    ],
  },
});

export const getScooterList = () =>
  apiClient.get('v5/scooter/list').json<{
    data: {
      items: Array<{
        sn_id: string;
        isDefault: true;
        sku_name: string;         // 'US Citi White'
        scooter_name: string;     // user defined name
        product_type: 'native';
        carframe_id: string;
        isMaster: boolean;
      }>;
    };
  }>();

type WheelStatus = {
  power_low: boolean;
  pressure_low: boolean;
  pressure_high: boolean;
  temperature_low: boolean;
  temperature_high: boolean;
  leak: boolean;
  communication_failure: boolean;
  paired: boolean;
  connected: boolean;
};

export const getDetail = (sn: string) => apiClient.get(`v5/scooter/detail/${sn}`).json<{
  data: {
    scooter_name: string;   // user defined name
    sn_id: string;
    sku_name: string;       // 'US Citi White'
    devices_array: Array<{
      device_name: string;
    }>;
    battery: string;        // battery level in percentage in string
    mileage: number;        // remaining mileage in kilometers
    soft_version: string;   // software version
    device_version: string; // maybe hardware version
    scooter_location_city: string; // city name
    bind_count: number;    // number of devices binded to this scooter
    is_lite: boolean;
    isDefault: boolean;
    isMaster: boolean;
    is_show_ecu_battery: boolean;
    engine_num: string;     // motor sn
    is_double_battery: boolean;
    carframe_id: string;    // frame sn
    BMS_firmware_ver: string;
    gpsTimestamp: string;   // unix time stamp in number
    infoTimestamp: string;   // unix time stamp in number
    battery_capacity: '0';  // unknown
  };
}>();

export const getStatus = (sn: string) =>
  apiClient.get('v5/scooter/motor_data/index_info', {searchParams: {sn}}).json<{
    data: {
      isCharging: 0 | 1;
      lockStatus: 0 | 1;
      isAccOn: 0 | 1;
      isFortificationOn: '0' | '1';
      isConnected: boolean;
      position: { lat: number; lng: number };
      hdop: number; // locate precision in horizontal direction;
      time: number;
      batteries: Record<'compartmentA' | 'compartmentB', {
        bmsId: string;
        isConnected: boolean;
        batteryCharging: number; // battery level in percentage
        gradeBattery: string; // battery health in percentage in string
      }>;
      leftTime: string;             // maybe estimated left time
      estimatedMileage: number;
      estimatedMileageRatio: number;
      gpsTimestamp: number;
      infoTimestamp: number;
      nowSpeed: number;
      shakingValue: number;
      locationType: number;
      batteryDetail: true;
      centreCtrlBattery: number;  // ECU Battery Level
      ss_protocol_ver: number;
      ss_online_sta: '0' | '1';
      gps: number;  // gps strength? maximum is 5?
      gsm: number;
      lastTrack: {
        ridingTime: number;         // seconds
        distance: number;        // meters
        time: number;        // timestamp
      };
      is_cushion_lock_on: boolean;      // the battery case?
      is_tire_gauge_connected: boolean;
      frontend_tire_gauge_value: number;      // unit is unknown
      backend_tire_gauge_value: number;
      front_wheel_id: string;      // not paired: '0'
      front_wheel_status: WheelStatus;
      front_wheel_pressure: number;       // unit is unknown
      back_wheel_id: string;
      back_wheel_status: WheelStatus;
      back_wheel_pressure: number;
      battery_cang_lock: boolean;
      cycling_model: '1' | '2';
      alarm_sound_status: boolean;
      charging_time: string;        // maybe time to full recharge
    };
  }>();

export const getBatteryStatus = (sn: string) =>
  apiClient.get('v3/motor_data/battery_info', {searchParams: {sn}})
    .json<{
      data: {
        batteries: Record<'compartmentA' | 'compartmentB', {
          items: Array<{x: number; y: number; z: number}>; // ??
          totalPoint: number;   // history entries count
          bmdId: string;
          isConnected: boolean;
          batteryCharging: number; // battery level in percentage
          chargedTimes: string; // times of battery charge 60% in string
          temperature: number;
          temperatureDesc: 'normal' | string;
          energyConsumedTody: number; // maybe energy consumed today in mAh
          gradeBattery: string; // battery health in percentage in string
        }>;
      };
      isCharging: 0 | 1;
      centreCtrlBattery: number;  // ECU Battery Level
      batteryDetail: boolean;
      estimatedMileage: number;
    }>();
