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
  var post_body = req.body;
  if (post_body)
    try {
      //TODO Prepared statements
      var queryString = `INSERT INTO env_logs(env_data) VALUES(\'${post_body.data}\')`;
      console.log(queryString);
      const client = await pool.connect();
      const result = await client.query(queryString);
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  res.send(post_body.data + ' inserted\n');
});

app.post('/postlogs', async (req, res) => {
  //{ token = "token", }
  var post_body = req.body;
  console.log(post_body);
  if (post_body) {
    if (post_body.type == "postlogs") {
      const token = post_body.token;
      try {
        const client = await pool.connect();
        const device_id = jwt.verify(token, jswSecret).device_id;
        console.log(device_id);
        var checkDeviceString = `SELECT id, token FROM device WHERE id = ${device_id}`;
        // console.log(checkDeviceString);
        var result = await client.query(checkDeviceString);
        // console.log(result);
        if (result.rowCount == 0) {
          res.status(401).send("Device is not paired.")
        } else {
          if (result.rows[0].token == token) {
            var addLogsString = `INSERT INTO device_datalogs(device_id, tvoc, eco2, raw_h2, raw_ethanol) VALUES (${device_id}, ${post_body.tvoc}, ${post_body.eco2}, ${post_body.raw_h2}, ${post_body.raw_ethanol})`;
            result = await client.query(addLogsString);
            res.status(201).send("Log succesfully inserted");
          } else {
            res.status(401).send("Device has wrong token.")
          }
        }

        client.release();
      } catch {
        res.status(401).send("Invalid token");
      }

    } else {
      res.status(400).send("Wrond \"type\" field");
    }
  } else {
    res.status(400).send("Empty body.");
  }
});

app.post('/createUser', async (req, res) => {
  var post_body = req.body;
  if (post_body)
    try {
      //TODO Prepared statements
      // console.log(post_body);
      var selectUserString = `SELECT username, email FROM users WHERE username = \'${post_body.username}\' OR email = \'${post_body.email}\'`;
      console.log(selectUserString)
      //var queryString = `INSERT INTO env_logs(env_data) VALUES(\'${post_body.data}\')`;
      // console.log(queryString);
      const client = await pool.connect();
      var result = await client.query(selectUserString);
      // console.log(result);
      if (result.rowCount > 0) {
        console.log("User with this email or password already exists");
        res.send("User with this email or password already exists");
      } else {
        if (post_body.passw == post_body.confpassw) {
          const plain_passw = post_body.passw;
          const pass_hash = await bcryptjs.hash(plain_passw, saltRounds);
          var createUserString = `INSERT INTO users(username, password_hash, email) VALUES (\'${post_body.username}\', \'${pass_hash}\', \'${post_body.email}\');`;
          console.log(createUserString);
          result = await client.query(createUserString);
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
});

app.post('/auth', async (req, res) => {
  var post_body = req.body;
  if (post_body)
    try {
      //TODO Prepared statements
      console.log(post_body);
      var selectUserString = `SELECT id, username, password_hash FROM users WHERE username = \'${post_body.username}\'`;
      console.log(selectUserString)
      //var queryString = `INSERT INTO env_logs(env_data) VALUES(\'${post_body.data}\')`;
      // console.log(queryString);
      const client = await pool.connect();
      var result = await client.query(selectUserString);
      // console.log(result);
      client.release();
      if (result.rowCount == 1) {
        const hash = result.rows[0].password_hash;
        const ver = await bcryptjs.compare(post_body.passw, hash);

        if (ver) {
          //TODO: fetch devices from database for user
          const newToken = jwt.sign({ id: result.rows[0].id }, jswSecret);
          res.cookie('token', newToken, { httpOnly: true });
          res.redirect(`/mydevices`);

        } else {
          console.log("Wrond password");
          res.status(401).send("Wrond password");
        }

      } else {
        console.log("User doesn't exist");
        res.send("User doesn't exist");
      }
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
});

app.post('/pair', async (req, res) => {
  var post_body = req.body;
  //{ "type" : "pair", "token": 321456, "model": "model_name", "serial": "serial111"}
  // console.log(post_body);
  if (post_body) {
    if (post_body.type == "pair") {
      try {
        //TODO Prepared statements
        var selectUserString = `SELECT user_id, token FROM secret_tokens WHERE token = ${post_body.token}`;
        console.log(selectUserString)
        const client = await pool.connect();
        var resultToken = await client.query(selectUserString);
        // console.log(resultToken);
        if (resultToken.rowCount == 1) {
          const user_id = resultToken.rows[0].user_id;
          var selectDeviceString = `SELECT model, serial, token FROM device WHERE user_id = ${user_id} AND model = \'${post_body.model}\' AND serial = \'${post_body.serial}\'`;
          // console.log(selectDeviceString)
          var resultDevice = await client.query(selectDeviceString);
          // console.log(resultDevice);
          if (resultDevice.rowCount == 0) {
            var addDeviceString = `INSERT INTO device(model, serial, user_id) values (\'${post_body.model}\', \'${post_body.serial}\', ${user_id}) RETURNING id`;
            var deleteTokenString = `DELETE from FROM secret_tokens WHERE token = ${post_body.token}`;
            await client.query(deleteTokenString);
            console.log(addDeviceString);
            resultDevice = await client.query(addDeviceString);
            const device_id = resultDevice.rows[0].id;
            console.log(device_id);
            //TODO: Add unique hash to the token (otherwise device can change it's id)
            const newToken = jwt.sign({ device_id: device_id }, jswSecret);
            var updateTokenString = `UPDATE device SET token = \'${newToken}\' WHERE id = ${device_id}`;
            await client.query(updateTokenString);
            console.log(updateTokenString);
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
    res.send("Empty POST body.");
  }
});

app.get('/delete', async (req, res) => {
  var deviceDeleteString = `DELETE FROM device WHERE id = ${req.query.device_id}`;
  const client = await pool.connect();
  try {
    await client.query(deviceDeleteString);
    res.redirect('/mydevices');
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
})

app.get('/auth', async (req, res) => {
  var post_body = req.body;
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
  console.log(addDevice);
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
  var selectLogsString = `SELECT date_taken, tvoc, eco2, raw_h2, raw_ethanol FROM device_datalogs WHERE device_id = \'${device_id}\'`;
  // console.log(se);

  var result = await client.query(selectLogsString);
  // console.log(result);
  client.release();
  const results = { logs: result.rows};
  res.render('pages/deviceLogs.ejs', results);
});

app.post('/logout', async (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

app.listen(PORT, () => console.log(`Listening on ${PORT}`));

