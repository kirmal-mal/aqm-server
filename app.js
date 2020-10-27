const express = require('express')
const path = require('path')

const bcryptjs = require('bcryptjs');
const saltRounds = 10;

var otpGenerator = require('otp-generator')

var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');


const PORT = process.env.PORT || 5000

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const jwt = require('jsonwebtoken');
const jswSecret = "sdDev";


const app = express();

app.use(cookieParser())
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: true }))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs');

app.get('/', (req, res) => res.render('pages/index'));

app.get('/test_logs', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM env_logs');
    const results = { 'results': (result) ? result.rows : null };
    res.render('pages/test_logs.ejs', results);
    client.release();
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
});

app.post('/envdata', async (req, res) => {
  const post_body = req.body;
  if (post_body)
    try {
      //TODO Prepared statements
      var queryString = 'INSERT INTO env_logs(env_data) VALUES($1)';
      console.log(queryString);
      const client = await pool.connect();
      const result = await client.query(queryString, [post_body.data]);
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  res.send(post_body.data + ' inserted\n');
});

app.post('/postlogs', async (req, res) => {
  //{ token = "token", }
  const post_body = req.body;
  const max_int = 2147483647;
  const min_int = -2147483648;
  const tvoc = parseInt(post_body.tvoc);
  const eco2 = parseInt(post_body.eco2);
  const raw_h2 = parseInt(post_body.raw_h2);
  const raw_ethanol = parseInt(post_body.raw_ethanol);
  console.log(`Logs with tvoc: ${tvoc}, eco2: ${eco2}, raw_h2: ${raw_h2}, raw_ethanol: ${raw_ethanol}.`)
  if (isNaN(tvoc) || isNaN(eco2) || isNaN(raw_h2) || isNaN(raw_ethanol) 
    || min_int > tvoc || tvoc > max_int || min_int > eco2 || eco2 > max_int || min_int > raw_h2 || raw_h2 > max_int || min_int > raw_ethanol || raw_ethanol > max_int) {
    res.status(400).send("Wrong input")
  } else {
    console.log(JSON.stringify(post_body));
    if (post_body) {
      if (post_body.type == "postlogs") {
        const token = post_body.token;
        try {
          const client = await pool.connect();
          const device_id = jwt.verify(token, jswSecret).device_id;
          var checkDeviceString = `SELECT id, token FROM device WHERE id = ${device_id}`;
          var result = await client.query(checkDeviceString);
          if (result.rowCount == 0) {
            res.status(401).send("Device is not paired.")
          } else {
            if (result.rows[0].token == token) {
              console.log("Token verified. Device id is: " + device_id);
              var addLogsString = "INSERT INTO device_datalogs(device_id, tvoc, eco2, raw_h2, raw_ethanol) VALUES ($1, $2, $3, $4, $5)";
              console.log(addLogsString);
              result = await client.query(addLogsString, [device_id, tvoc, eco2, raw_h2, raw_ethanol]);
              console.log(`Logs with tvoc: ${tvoc}, eco2: ${eco2}, raw_h2: ${raw_h2}, raw_ethanol: ${raw_ethanol} inserted.`)
              res.status(201).send("Log succesfully inserted");
            } else {
              res.status(401).send("Device has wrong token.")
            }
          }

          client.release();
        } catch {
          console.log(err);
          res.status(401).send("Invalid token");
        }

      } else {
        res.status(400).send("Wrond \"type\" field");
      }
    } else {
      res.status(400).send("Empty body.");
    }
  }
});

app.post('/createUser', async (req, res) => {
  const post_body = req.body;
  if (post_body && ("username" in post_body) && ("email" in post_body) && ("passw" in post_body) && ("confpassw" in post_body)
    && post_body.username && post_body.email && post_body.passw && post_body.confpassw) {
    try {
      //TODO Prepared statements
      console.log("Trying to create new user:\n" + JSON.stringify(post_body));
      var selectUserString = 'SELECT username, email FROM users WHERE username = $1 OR email = $2';
      console.log(selectUserString)
      // console.log(queryString);
      const client = await pool.connect();
      var result = await client.query(selectUserString, [post_body.username, post_body.email]);
      // console.log(result);
      if (result.rowCount > 0) {
        console.log("User with this email or password already exists");
        res.send("User with this email or password already exists");
      } else {
        if (post_body.passw == post_body.confpassw) {
          const plain_passw = post_body.passw;
          const pass_hash = await bcryptjs.hash(plain_passw, saltRounds);
          console.log("Creating new user:");
          var createUserString = `INSERT INTO users(username, password_hash, email) VALUES ($1, $2, $3);`;
          console.log(createUserString);
          result = await client.query(createUserString, [post_body.username, pass_hash, post_body.email]);
          if (result.rowCount == 1) {
            console.log(`User ${post_body.username} succesfully created.`);
            res.send(`User ${post_body.username} succesfully created.`);
          }
        } else {
          console.log("Passwords doesn\'t match!");
          res.send("Passwords doesn\'t match!");
        }
      }
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  } else {
    res.status(400).send("Wrong request");
  }
});

app.post('/auth', async (req, res) => {
  const post_body = req.body;
  if (post_body && post_body.username && post_body.passw) {
    try {
      //TODO Prepared statements
      console.log("Verifying user:\n" + JSON.stringify(post_body));
      var selectUserString = 'SELECT id, username, password_hash FROM users WHERE username = $1';
      const client = await pool.connect();
      var result = await client.query(selectUserString, [post_body.username]);
      // console.log(result);
      client.release();
      if (result.rowCount == 1) {
        console.log(`User ${post_body.username} exists. Checking password.`)
        const hash = result.rows[0].password_hash;
        const ver = await bcryptjs.compare(post_body.passw, hash);

        if (ver) {
          const newToken = jwt.sign({ id: result.rows[0].id }, jswSecret);
          res.cookie('token', newToken, { httpOnly: true });
          console.log(`User ${post_body.username} verifyed. Issuing a new cookie and redirecting to /mydevices.`);
          res.redirect(`/mydevices`);

        } else {
          console.log("Wrond password");
          res.status(401).send("Wrond password");
        }

      } else {
        console.log("User doesn't exist");
        res.status(401).send("User doesn't exist");
      }
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  } else {
    res.status(400).send("Wrong request body.");
  }
});

app.post('/pair', async (req, res) => {
  const post_body = req.body;
  //{ "type" : "pair", "token": 321456, "model": "model_name", "serial": "serial111"}
  console.log("Pairing request: " + JSON.stringify(post_body));
  const pair_token = parseInt(post_body.token);
  if (post_body && pair_token) {
    if (post_body.type == "pair") {
      try {
        //TODO Prepared statements
        var selectUserString = `SELECT user_id, token FROM secret_tokens WHERE token = $1`;
        console.log("Checking if token is correct for this user:\n");
        const client = await pool.connect();
        var resultToken = await client.query(selectUserString, [pair_token]);
        // console.log(resultToken);
        if (resultToken.rowCount == 1) {
          const user_id = resultToken.rows[0].user_id;
          console.log("Token is correct. Checking if device is already paired.")
          var selectDeviceString = `SELECT model, serial, token FROM device WHERE user_id = ${user_id} AND model = $1 AND serial = $2`;
          console.log(selectDeviceString)
          var resultDevice = await client.query(selectDeviceString, [post_body.model, post_body.serial]);
          // console.log(resultDevice);
          if (resultDevice.rowCount == 0) {
            var addDeviceString = `INSERT INTO device(model, serial, user_id) values ($1, $2, ${user_id}) RETURNING id`;
            var deleteTokenString = `DELETE FROM secret_tokens WHERE token = ${pair_token}`;
            console.log("Device is not found. Deliting a token from db:\n" + deleteTokenString);
            await client.query(deleteTokenString);
            resultDevice = await client.query(addDeviceString, [post_body.model, post_body.serial]);
            const device_id = resultDevice.rows[0].id;
            console.log("Recieved new device_id: " + device_id);
            //TODO: Add unique hash to the token (otherwise device can change it's id)
            const newToken = jwt.sign({ device_id: device_id }, jswSecret);
            var updateTokenString = `UPDATE device SET token = \'${newToken}\' WHERE id = ${device_id}`;
            await client.query(updateTokenString);
            console.log("Creating a new authorisation token for this device:\n" + updateTokenString);
            res.status(201).json({ token: newToken });
          } else {
            console.log("Already in DB");
            // console.log(resultDevice);
            res.status(418).json({ token: resultDevice.rows[0].token });
          }
        } else {
          console.log("Wrong device token.");
          res.status(401).send("Wrong device token.");
        }
        client.release();
      } catch (err) {
        console.error(err);
        res.send("Error " + err);
      }
    } else {
      res.send("Wrong \"type\" parameter in JSON.");
    }
  } else {
    res.status(400).send("Wrong POST body.");
  }
});

app.get('/delete', async (req, res) => {
  var deviceDeleteString = `DELETE FROM device WHERE id = $1`;
  const client = await pool.connect();
  try {
    await client.query(deviceDeleteString, [req.query.device_id]);
    res.redirect('/mydevices');
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
})

app.get('/auth', async (req, res) => {
  const post_body = req.body;
  const token = req.cookies.token;
  if (token) {
    jwt.verify(token, jswSecret, (err, verifiedJwt) => {
      if (err) {
        res.send(err.message)
      } else {
        res.redirect(`/mydevices`);
      }
    });
  } else {
    res.send("You are not logged in.")
  }
});

app.get('/mydevices', async (req, res) => {
  const id = jwt.decode(req.cookies.token).id;
  const addDevice = req.query.adddevice;
  console.log(id);

  const client = await pool.connect();
  //TODO: add token generator
  var devToken;
  var tokenString = "------"
  if (addDevice == "true") {
    var selectTokenString = `SELECT token, user_id FROM secret_tokens WHERE user_id = \'${id}\'`;
    // console.log(selectTokenString);
    //var queryString = `INSERT INTO env_logs(env_data) VALUES(\'${post_body.data}\')`;
    // console.log(queryString);

    var result = await client.query(selectTokenString);
    // console.log(result);
    if (result.rowCount == 0) {
      devToken = otpGenerator.generate(6, { upperCase: false, specialChars: false, digits: true, alphabets: false });
      var addTokenString = `INSERT INTO secret_tokens(token, user_id) VALUES(${devToken},\'${id}\')`;
      result = await client.query(addTokenString);
      // console.log(result);
    } else {
      devToken = result.rows[0].token;
      // console.log(result);
      console.log(devToken);
    }
    client.release();
    tokenString = `${devToken}`;
  }
  var selectDevicesString = `SELECT id, model, serial, date_connected FROM device WHERE user_id = ${id}`;
  result = await client.query(selectDevicesString);
  // console.log(result);
  const results = { devices: result.rows, token: tokenString };
  res.render('pages/myDevices.ejs', results);
});

app.get('/viewlogs', async (req, res) => {
  const device_id = req.query.device_id;

  const client = await pool.connect();
  var selectLogsString = `SELECT date_taken, tvoc, eco2, raw_h2, raw_ethanol FROM device_datalogs WHERE device_id = $1`;
  // console.log(se);

  var result = await client.query(selectLogsString, [device_id]);
  // console.log(result);
  client.release();
  const results = { logs: result.rows };
  res.render('pages/deviceLogs.ejs', results);
});

app.post('/logout', async (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));

