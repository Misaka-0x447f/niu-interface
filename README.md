## niu-interface
A network interface utility for Niu e-bike.

## install
`npm install niu-interface`

## methods
- `updateLoginInfo: (p: {username: string; password: string}) => Promise<void>`
- `updateToken: (newToken?: string) => Promise<void>` - refresh token or manually update token
- `getScooterList` - list all e-bikes, including name and sn, etc.
- `getDetail` - get detail by sn, return data such as battery, remaining mileage, etc.
- `getStatus` - another detail api.
- `getBatteryStatus` - get battery status by sn.
