import itertools
import sqlalchemy
import sqlalchemy.ext.associationproxy
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


def CascadeForeignKey(table):
    return ForeignKey(f'{table}.id', onupdate='CASCADE', ondelete='CASCADE')


def OneToOneRelationship(model, backref):
    return sqlalchemy.orm.relationship(
        model, lazy='joined', uselist=False,
        backref=sqlalchemy.orm.backref(backref, uselist=False))


class Tag(Model):
    __tablename__ = 'tags'

    id = Column(Integer, primary_key=True)

    name = Column(String(32), index=True, nullable=False)


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


def tag_relationship(secondary, backref):
    return sqlalchemy.orm.relationship(
        Tag, secondary=secondary, collection_class=set, lazy='selectin',
        backref=sqlalchemy.orm.backref(backref, collection_class=set))


def tag_proxy():
    return sqlalchemy.ext.associationproxy.association_proxy(
        '_tags', 'name', creator=lambda name: Tag(name=name))


def TagSecondary(table):
    return sqlalchemy.Table(
        f'{table}_tags', Model.metadata,
        Column(f'{table}_id', CascadeForeignKey(f'{table}s'), nullable=False),
        Column('tag_id', CascadeForeignKey('tags'), nullable=False),
        sqlalchemy.PrimaryKeyConstraint(f'{table}_id', 'tag_id'))
