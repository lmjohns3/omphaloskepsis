import enum
import sqlalchemy
import sqlalchemy.ext.associationproxy
import uuid

from . import db
from .accounts import Account


span_tags = sqlalchemy.Table(
    'span_tags', db.Model.metadata,
    db.Column('span_id', db.ForeignKey(
        'spans.id', onupdate='CASCADE', ondelete='CASCADE'), nullable=False),
    db.Column('tag_id', db.ForeignKey(
        'tags.id', onupdate='CASCADE', ondelete='CASCADE'), nullable=False),
    sqlalchemy.PrimaryKeyConstraint('span_id', 'tag_id'))


class Span(db.Model):
    __tablename__ = 'spans'

    id = db.Column(db.Integer, primary_key=True)

    uid = db.Column(db.String(40), default=lambda: str(uuid.uuid4()), unique=True, nullable=False)

    activity = db.Column(db.String, index=True, nullable=False)
    description = db.Column(db.String)

    account_id = db.Column(db.Integer, db.ForeignKey(
        'accounts.id', onupdate='CASCADE', ondelete='CASCADE'), nullable=False)
    account = sqlalchemy.orm.relationship(Account, backref='spans', uselist=False)

    _tags = sqlalchemy.orm.relationship(
        db.Tag, secondary=span_tags, collection_class=set,
        backref=sqlalchemy.orm.backref('spans', collection_class=set))
    tags = sqlalchemy.ext.associationproxy.association_proxy(
        '_tags', 'name', creator=lambda name: Tag(name=name))

    events = sqlalchemy.orm.relationship(
        'Event',
        backref=sqlalchemy.orm.backref('span', uselist=False),
        order_by='Event.utc')

    def __repr__(self):
        return f'<{self.activity}:{"".join(str(e) for e in self.events)}>'

    @property
    def first_event(self):
        return min(self.events, key=lambda e: e.utc) if self.events else None

    @property
    def last_event(self):
        return max(self.events, key=lambda e: e.utc) if self.events else None

    @property
    def duration_s(self):
        if len(self.events) < 2:
            return None
        return self.last_event.utc - self.first_event.utc

    @staticmethod
    def create_from_request(req):
        span = Span(account=req.account, activity=req.json['activity'])
        span.update_from(req.json)
        return span

    def update_from(self, data):
        db.update_tags(self, data.get('tags', '').strip())

    def to_dict(self):
        return dict(
            id=self.id,
            tags=sorted(self.tags),
            events=[dict(id=e.id, utc=e.utc) for e in self.events],
            activity=self.activity,
            description=self.description,
        )
