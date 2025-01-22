import re
import json
from datetime import datetime

import sqlite3
import pandas as pd
import numpy as np
from flask import Flask, request, send_from_directory


app = Flask(__name__)
DB_PATH = "../P1_reader/readings.db"


def validate_timestamp(timestamp):
    pattern = r"^\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])([0-5]\d)([0-5]\d)$"
    if re.match(pattern, timestamp):
        try:
            datetime.strptime(timestamp, "%y%m%d%H%M%S")
            return True
        except ValueError:
            return False
    return False


@app.route("/api/electricity/now")
def electricity_instant():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""\
SELECT timestamp, current_power_usage
FROM electricity_readings
ORDER BY timestamp DESC
LIMIT 1
        """)
        result = cursor.fetchone()

    power_usage = np.ceil(result[1] * 1000)
    return json.dumps([result[0], power_usage], default=str)


@app.route("/api/electricity")
def electricity():
    query_from = request.args.get('from')
    query_to   = request.args.get('to')
    
    if not query_from:
        return "Need to specify data range beginning", 400
    if not query_to:
        return "Need to specify data range end", 400
    
    if not validate_timestamp(query_from) or not validate_timestamp(query_to):
        return "Range specifiers need to be in format YYMMDDHHMMSS", 400
    
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(f"""\
SELECT timestamp, lifetime_power_t1 + lifetime_power_t2 as lifetime_power
FROM electricity_readings
WHERE timestamp < {query_from}
ORDER BY timestamp DESC
LIMIT 1
        """)
        last_before = cursor.fetchone()
    
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(f"""\
SELECT timestamp, lifetime_power_t1 + lifetime_power_t2 as lifetime_power
FROM electricity_readings
WHERE timestamp >= {query_from} AND timestamp <= {query_to}
ORDER BY timestamp DESC
LIMIT 1
        """)
        last_within = cursor.fetchone()
        
    if last_before is None or last_within is None:
        return "No entry found before the range or within the range", 404

    power_usage_from = np.ceil(last_before[1] * 1000)
    power_usage_to   = np.ceil(last_within[1] * 1000)
    power_usage = power_usage_to - power_usage_from

    return json.dumps(power_usage, default=str)


@app.route("/")
def index():
    return send_from_directory("doc", "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0")
