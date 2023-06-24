import base64
import json
import random
import re
import sqlalchemy
import struct
import time

from . import db


def encode_id(x):
    return base64.urlsafe_b64encode(struct.pack('>q', x))[:-1]

def decode_id(x):
    return struct.unpack('>q', base64.urlsafe_b64decode(x + b'='))[0]


class Account(db.Model):
    __tablename__ = 'accounts'

    id = db.Column(db.Integer, primary_key=True, default=lambda: random.getrandbits(63))

    created_utc = db.Column(db.Integer, default=time.time, nullable=False)

    email = db.Column(db.String(80), unique=True)
    validation_code = db.Column(db.String(128))
    validated_utc = db.Column(db.Integer)

    password = db.Column(db.LargeBinary)

    last_login_utc = db.Column(db.Integer)
    last_failure_utc = db.Column(db.Integer)
    failures_since_login = db.Column(db.Integer, default=0, nullable=False)

    reset_code = db.Column(db.String(128))
    reset_requested_utc = db.Column(db.Integer)

    blocked_utc = db.Column(db.Integer)

    # This is a JSON-encoded blob containing account settings.
    config = db.Column(db.LargeBinary, default='', nullable=False)

    @property
    def path_components(self):
        enc = encode_id(self.id)
        return enc[-1], enc[-2], f'{enc}.db'

    def update_from(self, data):
        if 'config' in data:
            self.config = json.dumps(data['config'])
        if self._valid_password(data.get('password', '')):
            self.password = data['password']

    def to_dict(self):
        return dict(
            config=json.loads(self.config),
            email=self.email,
            created_utc=self.created_utc,
            validated_utc=self.validated_utc,
            keys=[k.to_dict() for k in self.keys],
        )

    def _valid_password(self, p):
        return all((len(p) > 15,
                    p != self.password,
                    re.search(r'\w', p),
                    re.search(r'\W', p)))


class Key(db.Model):
    __tablename__ = 'keys'

    id = db.Column(db.Integer, primary_key=True)

    created_utc = db.Column(db.Integer, default=time.time, nullable=False)
    last_used_utc = db.Column(db.Integer)

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
            last_used_utc=self.last_used_utc,
            description=self.description,
            keyid=self.keyid,
            pubkey=self.pubkey,
        )
