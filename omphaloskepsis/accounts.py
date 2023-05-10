import base64
import json
import pendulum
import random
import sqlalchemy
import struct
import time

from . import db


def encode_id(x):
    return base64.b64encode(struct.pack('>q', x))[:-1]

def decode_id(x):
    return struct.unpack('>q', base64.b64decode(x + b'='))[0]


class Account(db.Model):
    __tablename__ = 'accounts'

    id = db.Column(db.Integer, primary_key=True, default=lambda: random.getrandbits(63))

    # This is a JSON-encoded blob containing account settings.
    config = db.Column(db.LargeBinary)

    @property
    def age_y(self):
        return pendulum.parse(self.birthday).age if self.birthday else None

    @property
    def heart_rate_max_bpm(self):
        # Many fits to experimental "max hr" data -- average a few of them.
        # https://www.trailrunnerworld.com/maximum-heart-rate-calculator/
        age = self.age_y
        if age is None:
            return None
        models = [220 - age, 217 - 0.85 * age, 206.9 - 0.67 * age]
        if self.is_male is not None:
            models.append(202 - 0.55 * age if self.is_male else 216 - 1.09 * age)
        return sum(models) / len(models)

    def to_dict(self):
        return dict(
            config=self.config,
            emails=[e.to_dict() for e in self.emails],
            keys=[k.to_dict() for k in self.keys],
        )


class Email(db.Model):
    __tablename__ = 'emails'

    id = db.Column(db.Integer, primary_key=True)

    created_utc = db.Column(db.Integer, default=time.time, nullable=False)
    last_use_utc = db.Column(db.Integer)

    account_id = db.Column(db.Integer, db.CascadeForeignKey('accounts'), nullable=False)
    account = sqlalchemy.orm.relationship(Account, backref='emails', lazy='selectin')

    email = db.Column(db.String(80), unique=True)

    validation = db.Column(db.String(128))
    validated_utc = db.Column(db.Integer, index=True)

    blocked_utc = db.Column(db.Integer, index=True)

    def to_dict(self):
        return dict(
            id=self.id,
            created_utc=self.created_utc,
            last_use_utc=self.last_use_utc,
            email=self.email,
        )


class Password(db.Model):
    __tablename__ = 'passwords'

    id = db.Column(db.Integer, primary_key=True)

    created_utc = db.Column(db.Integer, default=time.time, nullable=False)
    last_use_utc = db.Column(db.Integer)

    account_id = db.Column(db.Integer, db.CascadeForeignKey('accounts'), nullable=False)
    account = db.OneToOneRelationship(Account, 'password')

    password = db.Column(db.LargeBinary)
    failures = db.Column(db.Float, default=0)


class Key(db.Model):
    __tablename__ = 'keys'

    id = db.Column(db.Integer, primary_key=True)

    created_utc = db.Column(db.Integer, default=time.time, nullable=False)
    last_use_utc = db.Column(db.Integer)

    account_id = db.Column(db.Integer, db.CascadeForeignKey('accounts'), nullable=False)
    account = sqlalchemy.orm.relationship(Account, backref='keys', lazy='selectin')

    description = db.Column(db.String)
    keyid = db.Column(db.String, unique=True, nullable=False)
    pubkey = db.Column(db.LargeBinary, nullable=False)
    counter = db.Column(db.Integer, nullable=False)
    challenge = db.Column(db.LargeBinary)

    def to_dict(self):
        return dict(
            id=self.id,
            created_utc=self.created_utc,
            last_use_utc=self.last_use_utc,
            description=self.description,
            keyid=self.keyid,
            pubkey=self.pubkey,
        )
