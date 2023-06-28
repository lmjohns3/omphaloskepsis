import base64
import json
import os
import random
import re
import sqlalchemy
import sqlalchemy.ext.declarative
import struct
import time

from . import db

Model = sqlalchemy.ext.declarative.declarative_base()

def encode_id(x):
    return base64.urlsafe_b64encode(struct.pack('>q', x))[:-1]

def decode_id(x):
    return struct.unpack('>q', base64.urlsafe_b64decode(x + b'='))[0]


class Account(Model):
    __tablename__ = 'accounts'

    id = db.Column(db.Integer, primary_key=True, default=lambda: random.getrandbits(63))

    config = db.Column(db.LargeBinary)

    def open_db(self, root, echo=False):
        enc = encode_id(self.id).decode('utf8')
        path = os.path.join(root, enc[-1], enc[-2], f'{enc}.db')
        self.session = sqlalchemy.orm.sessionmaker(bind=db.engine(path, echo), autoflush=False)()

    def create_db(self, root):
        enc = encode_id(self.id).decode('utf8')
        path = os.path.join(root, enc[-1], enc[-2], f'{enc}.db')
        if not os.path.isdir(os.path.dirname(path)):
            os.makedirs(os.path.dirname(path))
        if not os.path.exists(path):
            db.Model.metadata.create_all(db.engine(path))

    def update_from(self, data):
        if 'config' in data:
            self.config = json.dumps(data['config'])
        if self.auth._valid_password(data.get('password', '')):
            self.auth.password = data['password']

    def to_dict(self):
        return dict(
            config=json.loads(self.config),
            auth=self.auth.to_dict(),
            keys=[k.to_dict() for k in self.keys],
        )


class Auth(Model):
    __tablename__ = 'auths'

    id = db.Column(db.Integer, primary_key=True)

    account_id = db.Column(db.Integer, db.CascadeForeignKey('accounts'), nullable=False)
    account = db.OneToOneRelationship(Account, 'auth')

    created_utc = db.Column(db.Integer, default=time.time, nullable=False)

    last_success_utc = db.Column(db.Integer, default=-1, nullable=False)
    last_failure_utc = db.Column(db.Integer, default=-1, nullable=False)
    failures_since_success = db.Column(db.Integer, default=0, nullable=False)

    blocked_utc = db.Column(db.Integer, default=-1, nullable=False)

    email = db.Column(db.String(80), unique=True, nullable=False)
    validation_code = db.Column(db.String(128))
    validated_utc = db.Column(db.Integer, default=-1, nullable=False)

    password = db.Column(db.LargeBinary)
    reset_code = db.Column(db.String(128))
    reset_requested_utc = db.Column(db.Integer, default=-1, nullable=False)

    def _valid_password(self, p):
        return all((len(p) > 15,
                    p != self.password,
                    re.search(r'\w', p),
                    re.search(r'\W', p)))

    def to_dict(self):
        return dict(
            email=self.email,
            last_success_utc=self.last_success_utc,
            last_failure_utc=self.last_failure_utc,
            validated_utc=self.validated_utc,
        )


class Key(Model):
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
