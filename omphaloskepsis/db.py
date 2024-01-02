import sqlalchemy

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
