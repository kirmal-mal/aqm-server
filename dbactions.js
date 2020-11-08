const bcryptjs = require('bcryptjs');
const saltRounds = 10;

const jwt = require('jsonwebtoken');
const jswSecret = "sdDev";

const { Pool } = require('pg');
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: {
		rejectUnauthorized: false
	}
});

async function createUser(username, password, email) {
	var response = { ret: false, status: 500, msg: '' };
	try {
		//TODO Prepared statements
		console.log(`Trying to create new user: ${username}, email: ${email}`);
		var selectUserString = 'SELECT username, email FROM users WHERE username = $1 OR email = $2';
		console.log(selectUserString)
		// console.log(queryString);
		const client = await pool.connect();
		var result = await client.query(selectUserString, [username, email]);
		// console.log(result);
		if (result.rowCount > 0) {
			console.log("User with this email or password already exists");
			response.msg = "User with this email or password already exists";
		} else {
			const pass_hash = await bcryptjs.hash(password, saltRounds);
			console.log("Creating new user:");
			var createUserString = `INSERT INTO users(username, password_hash, email) VALUES ($1, $2, $3);`;
			console.log(createUserString);
			result = await client.query(createUserString, [username, pass_hash, email]);
			if (result.rowCount == 1) {
				response.msg = `User ${username} succesfully created.`;
				response.ret = true;
				response.status = 201;
			}
		}
		client.release();
	} catch (err) {
		console.error(err);
		response.msg = "There was and internal error";
		response.status = 500;
	}
	return response;
}
async function verifyUser(username, passw) {
	var response = { ret: false, status: 500, msg: '', cookie: '' };
	try {
		//TODO Prepared statements
		console.log(`Verifying user: ${username} \n`);
		var selectUserString = 'SELECT id, username, password_hash FROM users WHERE username = $1';
		const client = await pool.connect();
		var result = await client.query(selectUserString, [username]);
		// console.log(result);
		client.release();
		if (result.rowCount == 1) {
			console.log(`User ${username} exists. Checking password.`)
			const hash = result.rows[0].password_hash;
			const ver = await bcryptjs.compare(passw, hash);

			if (ver) {
				const newToken = jwt.sign({ id: result.rows[0].id }, jswSecret);

				response.cookie = newToken;
				response.ret = true;
				response.status = 200;
			} else {
				response.ret = false;
				response.status = 401;
				response.msg = "Wrond password";
				console.log(msg);
			}
		} else {
			response.ret = false;
			response.ret = 401;
			response.msg = "User doesn't exist";
			console.log(msg);
		}
	} catch (err) {
		response.ret = false;
		response.ret = 500;
		response.msg = "Internal error";
		console.error(err);
	}
	return response;
}

async function getLogs(device_id, n) {
	const client = await pool.connect();
	if (!n) {
		n = 0;
	}
	var selectLogsString = `SELECT date_taken, tvoc, eco2, raw_h2, raw_ethanol FROM device_datalogs WHERE device_id = $1  ORDER BY date_taken DESC` + (n == 0 ? "" : ` LIMIT ${n}`);
	console.log(selectLogsString);

	var result = await client.query(selectLogsString, [device_id]);
	// console.log(result);
	client.release();
	const results = { logs: result.rows };
	// console.log(results);
	return results;
}

async function getCoords(device_id) {
	const client = await pool.connect();
	var selectLatLonString = `SELECT lat, lon FROM device WHERE id = $1`;
	console.log(selectLatLonString);

	var result = await client.query(selectLatLonString, [device_id]);
	// console.log(result);
	client.release();
	var results;
	if (result.rowCount == 1) {
		results = { coords: {lat: result.rows[0].lat, lon : result.rows[0].lon} };
	} else {
		results = { coords: {lat: null, lon : null} };
	}
	// console.log(results);
	return results;
}

async function changeCoordinates(device_id, lat, lon) {
	var response = { ret: false, status: 500, msg: ''};
	const client = await pool.connect();
	var updateCoordsString = `UPDATE device SET lat = $1, lon = $2 WHERE id = $3`;
	//console.log(updateCoordsString);

	var result = await client.query(updateCoordsString, [lat, lon, device_id]);
	console.log(result);
	client.release();
	response.msg = "Coordinates sucessfully changed.";
	response.status = 201;
	response.ret = true;
	return response;
}

module.exports = { createUser, verifyUser, getLogs, changeCoordinates, getCoords }