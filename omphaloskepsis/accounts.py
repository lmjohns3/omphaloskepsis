import base64
import os
import random
import re
import struct
import time

from . import db
from . import snapshots

Model = db.declarative_base()

def encode_id(x):
    return base64.urlsafe_b64encode(struct.pack('>q', x))[:-1]

def decode_id(x):
    return struct.unpack('>q', base64.urlsafe_b64decode(x + b'='))[0]


class Account(Model):
    __tablename__ = 'accounts'

    STRINGS = frozenset()

    id = db.Column(db.Integer, primary_key=True, default=lambda: random.getrandbits(63))

    kv = db.Column(db.LargeBinary)

    def open_db(self, root, echo=False):
        enc = encode_id(self.id).decode('utf8')
        path = os.path.join(root, enc[-1], enc[-2], f'{enc}.db')
        self.session = db.sessionmaker(bind=db.engine(path, echo), autoflush=False)()

    def create_db(self, root):
        enc = encode_id(self.id).decode('utf8')
        path = os.path.join(root, enc[-1], enc[-2], f'{enc}.db')
        if not os.path.isdir(os.path.dirname(path)):
            os.makedirs(os.path.dirname(path))
        if not os.path.exists(path):
            snapshots.Model.metadata.create_all(db.engine(path))

    def update_from(self, data):
        self.kv = db.update_json(self.kv, data, Account.STRINGS)

    def to_dict(self):
        return dict(
            kv=db.decompress_json(self.kv),
            auth=self.auth.to_dict(),
            keys=[k.to_dict() for k in self.keys],
        )


def AccountKeyColumn():
    fk = db.ForeignKey('accounts.id', onupdate='CASCADE', ondelete='CASCADE')
    return db.Column(db.Integer, fk, nullable=False)


class Auth(Model):
    __tablename__ = 'auths'

    id = db.Column(db.Integer, primary_key=True)

    account_id = AccountKeyColumn()
    account = db.relationship(Account, lazy='joined', uselist=False,
                              backref=db.backref('auth', uselist=False))

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
        return all((len(p) > 7,
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

    account_id = AccountKeyColumn()
    account = db.relationship(Account, backref='keys', lazy='selectin')

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
