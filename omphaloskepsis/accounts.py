import pendulum
import sqlalchemy
import uuid

from . import db


class Account(db.Model):
    __tablename__ = 'accounts'

    id = db.Column(db.Integer, primary_key=True)

    uid = db.Column(db.String(40), default=lambda: str(uuid.uuid4()), unique=True, nullable=False)

    email = db.Column(db.String(80), unique=True)

    name = db.Column(db.String(80))
    birthday = db.Column(db.String(10))
    is_male = db.Column(db.Integer)
    is_active = db.Column(db.Integer, default=1)

    def __repr__(self):
        return self.uid

    @property
    def age_y(self):
        return pendulum.parse(self.birthday).age if self.birthday else None

    @property
    def hr_max(self):
        # Many fits to experimental "max hr" data -- average a few of them.
        # https://www.trailrunnerworld.com/maximum-heart-rate-calculator/
        age = self.age_y
        male = self.is_male
        return None if age is None or is_male is None else (
            220 - age +
            217 - 0.85 * age +
            206.9 - 0.67 * age +
            (202 - 0.55 * age) if is_male else (216 - 1.09 * age)
        ) / 4


class Password(db.Model):
    __tablename__ = 'passwords'

    id = db.Column(db.Integer, primary_key=True)
    
    account_id = db.Column(db.Integer, db.ForeignKey(
        'accounts.id', onupdate='CASCADE', ondelete='CASCADE'), nullable=False)
    account = sqlalchemy.orm.relationship(
        Account, backref=sqlalchemy.orm.backref('password', uselist=False), uselist=False)

    password = db.Column(db.String(80))
    failure_count = db.Column(db.Integer, default=0)


class Credential(db.Model):
    __tablename__ = 'credentials'

    id = db.Column(db.Integer, primary_key=True)

    account_id = db.Column(db.Integer, db.ForeignKey(
        'accounts.id', onupdate='CASCADE', ondelete='CASCADE'), nullable=False)
    account = sqlalchemy.orm.relationship(Account, backref='credentials')

    credential_id = db.Column(db.String, unique=True, nullable=False)
    credential_public_key = db.Column(db.LargeBinary, nullable=False)
