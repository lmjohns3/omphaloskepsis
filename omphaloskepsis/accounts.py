import base64
import os
import random
import re
import struct
import time

from . import db
from . import measurements

Model = db.declarative_base()

def encode_id(x):
    return base64.urlsafe_b64encode(struct.pack('>q', x))[:-1]

def decode_id(x):
    return struct.unpack('>q', base64.urlsafe_b64decode(x + b'='))[0]

def path(root, x):
    enc = encode_id(x).decode('utf8')
    return os.path.join(root, enc[-1], enc[-2], f'{enc}.db')

def create(root, x):
    p = path(root, x)
    if not os.path.isdir(os.path.dirname(p)):
        os.makedirs(os.path.dirname(p))
    elif os.path.exists(p):
        os.unlink(p)
    engine = db.engine(p)
    measurements.Model.metadata.create_all(engine)
    sess = db.sessionmaker(bind=engine, autoflush=False)()
    sess.add(measurements.Profile())
    sess.commit()


def AccountIdColumn():
    fk = db.ForeignKey('accounts.id', onupdate='CASCADE', ondelete='CASCADE')
    return db.Column(db.Integer, fk, nullable=False)

def account_relationship(backref, order_by=None):
    kwargs = dict(lazy='selectin', uselist=False, backref=backref)
    if order_by:
        kwargs['order_by'] = order_by
    return db.relationship(Account, **kwargs)


class Account(Model):
    __tablename__ = 'accounts'

    id = db.Column(db.Integer, primary_key=True, default=lambda: random.getrandbits(63))

    blocked_utc = db.Column(db.Integer, default=-1, nullable=False)

    def to_dict(self):
        return dict(
            emails=[e.to_dict() for e in self.emails],
            passwords=[p.to_dict() for p in self.passwords],
            authenticators=[a.to_dict() for a in self.authenticators],
            keys=[k.to_dict() for k in self.keys],
       )


class Email(Model):
    __tablename__ = 'emails'

    id = db.Column(db.Integer, primary_key=True)

    account_id = AccountIdColumn()
    account = account_relationship('emails')

    created_utc = db.Column(db.Integer, default=time.time, nullable=False)
    validated_utc = db.Column(db.Integer, default=-1, nullable=False)

    email = db.Column(db.String(80), unique=True, nullable=False)
    validation_code = db.Column(db.String(128))

    def to_dict(self):
        return dict(
            email=self.email,
            created_utc=self.created_utc,
            validated_utc=self.validated_utc,
        )


class Password(Model):
    __tablename__ = 'passwords'

    id = db.Column(db.Integer, primary_key=True)

    account_id = AccountIdColumn()
    account = account_relationship('passwords', order_by='Password.created_utc.desc()')

    created_utc = db.Column(db.Integer, default=time.time, nullable=False)
    last_success_utc = db.Column(db.Integer, default=-1, nullable=False)
    last_failure_utc = db.Column(db.Integer, default=-1, nullable=False)
    failures_since_success = db.Column(db.Integer, default=0, nullable=False)
    reset_requested_utc = db.Column(db.Integer, default=-1, nullable=False)

    password = db.Column(db.LargeBinary)
    reset_code = db.Column(db.String(128))

    def is_valid_password(self, p):
        return all((8 <= len(p) <= 64, re.search(r'\w', p), re.search(r'\W', p)))

    def to_dict(self):
        return dict(
            created_utc=self.created_utc,
            last_success_utc=self.last_success_utc,
            last_failure_utc=self.last_failure_utc,
        )


class Authenticator(Model):
    __tablename__ = 'authenticators'

    id = db.Column(db.Integer, primary_key=True)

    account_id = AccountIdColumn()
    account = account_relationship('authenticators')

    created_utc = db.Column(db.Integer, default=time.time, nullable=False)
    last_success_utc = db.Column(db.Integer, default=-1, nullable=False)
    last_failure_utc = db.Column(db.Integer, default=-1, nullable=False)
    failures_since_success = db.Column(db.Integer, default=0, nullable=False)

    secret = db.Column(db.String(32), nullable=False)

    def to_dict(self):
        return dict(
            created_utc=self.created_utc,
            last_success_utc=self.last_success_utc,
            last_failure_utc=self.last_failure_utc,
        )


class Key(Model):
    __tablename__ = 'keys'

    id = db.Column(db.Integer, primary_key=True)

    account_id = AccountIdColumn()
    account = account_relationship('keys')

    created_utc = db.Column(db.Integer, default=time.time, nullable=False)
    last_success_utc = db.Column(db.Integer, default=-1, nullable=False)
    last_failure_utc = db.Column(db.Integer, default=-1, nullable=False)
    failures_since_success = db.Column(db.Integer, default=0, nullable=False)

    description = db.Column(db.String)
    keyid = db.Column(db.String, unique=True, nullable=False)
    pubkey = db.Column(db.LargeBinary, nullable=False)
    counter = db.Column(db.Integer, nullable=False)
    challenge = db.Column(db.LargeBinary)

    def to_dict(self):
        return dict(
            id=self.id,
            created_utc=self.created_utc,
            last_success_utc=self.last_success_utc,
            last_failure_utc=self.last_failure_utc,
            description=self.description,
            keyid=self.keyid,
            pubkey=self.pubkey,
        )
