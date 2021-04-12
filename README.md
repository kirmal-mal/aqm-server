# aqm-server

### AQM Server
Application server is a Node.js server that accepts information from the devices and provides simple user interface to add a new device or view data recieved from the device.

The server has following functions:
- Helper methods for the user interface
  - Add the new user to the database
  - Authenticate user
  - Pair the new device
  - Return the list of devices for the user
  - Return the device readings
- Pair the new device
  - Create the pair token for the device
  - The API JSON for device pairing:<br/>
  
  ```
  {
    "type" : "pair", 
    "token": "%pairing_token_from_the_website", 
    "model": "%model_of_the_device%", 
    "serial": "%serial_number_for_the_device%"
  }
  ```
  
- Accept data from the device
  - The API JSON to post the logs is following:<br/>
  
  ```
  {
    "type": "postlogs",
    "token": "%token_for_the_paired_device",
    "tvoc": "%tvoc_reading%",
    "eco2": "%eco2_reading%",
    "raw_h2": "%raw_h2_reading%",
    "raw_ethanol": "%raw_ethanol_reading%"
  }
  ```
  
  - Add recieved logs to the database
### User Interface
<br />
<img src ="https://cdn.discordapp.com/attachments/784915386151731251/784997681255940116/unknown.png" />
<br />
<img src ="https://media.discordapp.net/attachments/784915386151731251/784998011142012988/unknown.png?width=266&height=338" />
The login/signup page for the project. Upon signing in, you are redirected to:
<br />
<img src ="https://media.discordapp.net/attachments/784915386151731251/785000719296102400/unknown.png" />

This displays the location of each device, the token to add a new device, and some information about the currently connected devices.

<img src = "https://cdn.discordapp.com/attachments/784915386151731251/785000796370108466/unknown.png" />

Pressing Add Device displays a new device token for pairing. Log out returns to the previous screen. 

Devices are shown with their ID, model, name, and date/time of the last recieved reading.  
<img src = "https://cdn.discordapp.com/attachments/784915386151731251/785000888234278912/unknown.png" />

## Product Usage Guide

### 1. Online Profile
  Currently the website is deployed on heroku by the address: [https://sd-env-logs-server.herokuapp.com/](https://sd-env-logs-server.herokuapp.com/)
  1. First user needs an account. To create one you need to enter the credentials into the register form:<br/>
  <img src ="https://cdn.discordapp.com/attachments/784915386151731251/785025213800120320/unknown.png" width="200" height="300" />
  2. After registration or if you already have an account, you can log in using following form:
  <img src ="https://cdn.discordapp.com/attachments/784915386151731251/785025478238797854/unknown.png" width="200" height="200" />
  3. Once you authorised you will see the follwing screen:
  <img src ="https://cdn.discordapp.com/attachments/784915386151731251/785028120850858024/unknown.png" width="600" height="200" /> 

### 2. Pairing the device
  1. To pair the device you need to press "add device" button on the account screen:
  <img src ="https://cdn.discordapp.com/attachments/784915386151731251/785025569615380520/unknown.png" width="400" height="200" />
  2. After you press the button, the server will give you an pairing token.
  <img src ="https://cdn.discordapp.com/attachments/784915386151731251/785025642441867274/unknown.png" width="400" height="200" />
  3. This token should be sent in JSON object from the device with the POST request in the following format:
  
  ```
  {
    "type" : "pair", 
    "token": "%pairing_token_from_the_website", 
    "model": "%model_of_the_device%", 
    "serial": "%serial_number_for_the_device%"
  }
  ```
  
  <br/>
  Python example:
  <img src ="https://cdn.discordapp.com/attachments/784915386151731251/785025805846708265/unknown.png" width="800" height="200" />
  4. As a response you will recieve a JSON object with authorisation token:<br/>
  
```
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXZpY2VfaWQiOjMxLCJpYXQiOjE2MDcyMzYxMjl9.HlnK8NPzoY2RMk0swNlEyzlAoh2-04K6HPvZ_jUSqck"
}
```

### 3. Sending the data
1. To send the data you need to send a post request to the following address: https://sd-env-logs-server.herokuapp.com/postlogs
2. The JSON format included in the request is following:
```
  {
    "type": "postlogs",
    "token": "%token_for_the_paired_device",
    "tvoc": "%tvoc_reading%",
    "eco2": "%eco2_reading%",
    "raw_h2": "%raw_h2_reading%",
    "raw_ethanol": "%raw_ethanol_reading%"
  }
``` 
  <br/>
  Python example:
  <img src ="https://media.discordapp.net/attachments/784915386151731251/785026766912880680/unknown.png" width="800" height="150" />
3. To stop device from sending the data you should delete this device from the user by pressing "X" next to the device:
<img src ="https://cdn.discordapp.com/attachments/784915386151731251/785027053702348830/unknown.png" width="800" height="75" />

### 4. Viewing the data
1. To view the data you press the "view logs" button on the device string. You will see the following screen:
<img src ="https://cdn.discordapp.com/attachments/784915386151731251/785026937256673290/unknown.png" width="800" height="300" />
