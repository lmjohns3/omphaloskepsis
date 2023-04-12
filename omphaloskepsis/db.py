import click
import itertools
import sqlalchemy
import sqlalchemy.ext.declarative

from sqlalchemy import Column, Float, ForeignKey, Integer, LargeBinary, String, Text

Model = sqlalchemy.ext.declarative.declarative_base()


@sqlalchemy.event.listens_for(sqlalchemy.engine.Engine, 'connect')
def set_sqlite_pragma(dbapi_connection, connection_record):
    cur = dbapi_connection.cursor()
    cur.execute('PRAGMA encoding = "UTF-8"')
    cur.execute('PRAGMA foreign_keys = ON')
    cur.execute('PRAGMA journal_mode = WAL')
    cur.execute('PRAGMA synchronous = NORMAL')
    cur.close()


@sqlalchemy.event.listens_for(sqlalchemy.orm.session.Session, 'before_flush')
def use_existing_tags(sess, context, instances):
    for obj in itertools.chain(sess.new, sess.dirty):
        if not hasattr(obj, '_tags'):
            continue
        if all(t.id is not None for t in obj._tags):
            continue
        existing = dict(sess.query(Tag.name, Tag).filter(Tag.name.in_(obj.tags)))
        for tag in tuple(obj._tags):
            if tag.name in existing:
                obj.tags.discard(tag.name)
                obj._tags.add(existing[tag.name])
                sess.expunge(tag)


class Keyed:
    JSON_KEYS = ()

    def update_from(self, data):
        for key in self.JSON_KEYS:
            if key in data:
                setattr(self, key, data[key])

    def to_dict(self):
        return {key: getattr(self, key) for key in self.JSON_KEYS}


class Tag(Model):
    __tablename__ = 'tags'

    id = Column(Integer, primary_key=True)

    name = Column(String(32), index=True, nullable=False)

    def __repr__(self):
        return click.style(f' {self.name} ', bg='green', fg='black')


def update_tags(target, tags):
    for tag in tags:
        tag = tag.strip().lower()
        if tag == '-':
            for tag in tuple(target.tags):
                target.tags.remove(tag)
        elif tag.startswith('-'):
            target.tags.discard(tag[1:])
        else:
            target.tags.add(tag)
