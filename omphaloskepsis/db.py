import json
import sqlalchemy
import zlib

# Create some aliases for sqlalchemy symbols.
from sqlalchemy import Column, Float, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import backref, relationship, sessionmaker


def engine(path, echo=False):
    return sqlalchemy.create_engine(f'sqlite:///{path}', echo=echo)


@sqlalchemy.event.listens_for(sqlalchemy.engine.Engine, 'connect')
def set_sqlite_pragma(dbapi_connection, connection_record):
    cur = dbapi_connection.cursor()
    cur.execute('PRAGMA encoding = "UTF-8"')
    cur.execute('PRAGMA foreign_keys = ON')
    cur.execute('PRAGMA journal_mode = WAL')
    cur.execute('PRAGMA synchronous = NORMAL')
    cur.close()


def decompress_json(compressed):
    try:
        return json.loads(zlib.decompress(compressed).decode('utf8'))
    except:
        return {}


def compress_json(obj):
    return zlib.compress(json.dumps(obj).encode('utf8'))


def update_json(compressed, updates, allowed_strings):
    if not updates:
        return compressed
    current = decompress_json(compressed)
    for key, value in updates.items():
        if value is None:
            if key in current:
                del current[key]
        elif isinstance(value, (bool, int, float)):
            current[key] = value
        elif isinstance(value, str) and key in allowed_strings:
            current[key] = value
    return compress_json(current)
