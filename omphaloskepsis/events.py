import pendulum
import sqlalchemy
import sqlalchemy.ext.associationproxy
import uuid

from . import db
from .accounts import Account


event_tags = sqlalchemy.Table(
    'event_tags', db.Model.metadata,
    db.Column('event_id', db.ForeignKey(
        'events.id', onupdate='CASCADE', ondelete='CASCADE'), nullable=False),
    db.Column('tag_id', db.ForeignKey(
        'tags.id', onupdate='CASCADE', ondelete='CASCADE'), nullable=False),
    sqlalchemy.PrimaryKeyConstraint('event_id', 'tag_id'))


class Event(db.Model):
    __tablename__ = 'events'

    id = db.Column(db.Integer, primary_key=True)

    uid = db.Column(db.String(40), default=lambda: str(uuid.uuid4()), unique=True, nullable=False)

    account_id = db.Column(db.Integer, db.ForeignKey(
        'accounts.id', onupdate='CASCADE', ondelete='CASCADE'), nullable=False)
    account = sqlalchemy.orm.relationship(Account, backref='events', uselist=False)

    _tags = sqlalchemy.orm.relationship(
        db.Tag, secondary=event_tags, collection_class=set,
        backref=sqlalchemy.orm.backref('events', collection_class=set))
    tags = sqlalchemy.ext.associationproxy.association_proxy(
        '_tags', 'name', creator=lambda name: Tag(name=name))

    span_id = db.Column(db.Integer, db.ForeignKey(
        'spans.id', onupdate='CASCADE', ondelete='SET NULL'))

    lat = db.Column(db.Float, index=True)
    lng = db.Column(db.Float, index=True)
    utc = db.Column(db.Float, index=True, nullable=False)  # Unix timestamp.
    tz = db.Column(db.String, nullable=False)

    def __repr__(self):
        return f'#{self.localtime}'

    @property
    def utctime(self):
        return pendulum.from_timestamp(self.utc)

    @property
    def localtime(self):
        return pendulum.from_timestamp(self.utc, tz=self.tz)

    @classmethod
    def create_from_request(cls, req):
        event = cls(account=req.account)
        event.update_from(req.json)
        return event

    def update_from(self, data):
        db.update_tags(self, data.get('tags', []))

        if 'utc' in data:
            self.utc = float(data['utc'])
        if 'tz' in data and pendulum.now(data['tz']):
            self.tz = data['tz']
        if 'lat' in data and -90 < float(data['lat']) < 90:
            self.lat = data['lat']
        if 'lng' in data and -180 < float(data['lng']) < 180:
            self.lng = data['lng']

        for cls in (Exercise, Note, Vitals):
            if any(key in data for key in cls.JSON_KEYS):
                attr = cls.__name__.lower()
                if not getattr(self, attr, None):
                    setattr(self, attr, cls())
                getattr(self, attr).update_from(data)

    def to_dict(self):
        return dict(
            uid=self.uid,
            utc=self.utc,
            tz=self.tz,
            lat=self.lat,
            lng=self.lng,
            tags=sorted(self.tags),
            span=self.span.to_dict() if self.span else None,
            note=self.note.to_dict() if self.note else None,
            vitals=self.vitals.to_dict() if self.vitals else None,
            exercise=self.exercise.to_dict() if self.exercise else None,
        )


class Note(db.Model, db.Keyed):
    __tablename__ = 'notes'

    id = db.Column(db.Integer, primary_key=True)

    event_id = db.Column(
        db.Integer,
        db.ForeignKey('events.id', onupdate='CASCADE', ondelete='CASCADE'),
        unique=True,
        nullable=False)
    event = sqlalchemy.orm.relationship(
        Event, backref=sqlalchemy.orm.backref('note', uselist=False),
        uselist=False)

    note = db.Column(db.Text, nullable=False, default='')

    JSON_KEYS = ('note', )

    @property
    def blurb(self):
        return ' '.join([w for w in self.note.replace('>', ' ').split()
                         if w[0] not in '<=-#'][:20])


class Exercise(db.Model, db.Keyed):
    __tablename__ = 'exercises'

    id = db.Column(db.Integer, primary_key=True)

    event_id = db.Column(
        db.Integer,
        db.ForeignKey('events.id', onupdate='CASCADE', ondelete='CASCADE'),
        unique=True,
        nullable=False)
    event = sqlalchemy.orm.relationship(
        Event, backref=sqlalchemy.orm.backref('exercise', uselist=False),
        uselist=False)

    exercise = db.Column(db.String, index=True, nullable=False)
    duration_s = db.Column(db.Float, default=0, nullable=False)

    # Discrete wavelet transform of heart rate R-R intervals in milliseconds.
    rr_coeffs = db.Column(db.LargeBinary)
    rr_count = db.Column(db.Integer)

    # Measurements potentially reported by exercise equipment.
    reps = db.Column(db.Integer)
    resistance = db.Column(db.Float)
    distance_m = db.Column(db.Float)
    cadence_hz = db.Column(db.Float)
    avg_power_w = db.Column(db.Float)

    JSON_KEYS = (
        'exercise', 'duration_s', 'rr_coeffs', 'rr_count',
        'reps', 'resistance', 'distance_m', 'cadence_hz', 'avg_power_w',
    )


class Vitals(db.Model, db.Keyed):
    __tablename__ = 'vitals'

    id = db.Column(db.Integer, primary_key=True)

    event_id = db.Column(
        db.Integer,
        db.ForeignKey('events.id', onupdate='CASCADE', ondelete='CASCADE'),
        unique=True,
        nullable=False)
    event = sqlalchemy.orm.relationship(
        Event, backref=sqlalchemy.orm.backref('vitals', uselist=False),
        uselist=False)

    height_cm = db.Column(db.Float)
    weight_kg = db.Column(db.Float)
    vo2_max = db.Column(db.Float)

    supine_hr_bpm = db.Column(db.Float)
    sitting_hr_bpm = db.Column(db.Float)
    standing_hr_bpm = db.Column(db.Float)

    temperature_degc = db.Column(db.Float)

    # Specific emotions. Range: 0.0 (not at all) --- 1.0 (completely)
    happy = db.Column(db.Float)
    sad = db.Column(db.Float)
    angry = db.Column(db.Float)
    afraid = db.Column(db.Float)

    # General mood. Range: -1.0 (despondent) -- 0.0 (neutral) -- 1.0 (elated)
    mood = db.Column(db.Float)

    JSON_KEYS = ('height_cm', 'weight_kg', 'vo2_max',
                 'supine_hr_bpm', 'sitting_hr_bpm', 'standing_hr_bpm',
                 'temperature_degc',
                 'happy', 'sad', 'angry', 'afraid', 'mood')

    @property
    def bmi(self):
        height_m = self.height_cm / 100
        return self.weight_kg / height_m / height_m

    def update_from(self, data):
        super().update_from(data)

        acct = self.event.account

        if ('walk_time_min' in data and
            'walk_hr_bpm' in data and
            acct.is_male is not None and
            acct.age_y is not None):
            # Rockport method: Walk 1 mile, measure time and HR at end of walk.
            # https://www.calculatorpro.com/calculator/vo2-max-calculator/
            # http://www.shapesense.com/fitness-exercise/calculators/vo2max-calculator.shtml
            self.vo2_max = (132.8530
                            + 6.3150 * acct.is_male
                            - 0.1695 * self.weight_kg
                            - 0.3877 * acct.age_y
                            - 3.2649 * float(data['walk_time_min'])
                            - 0.1565 * float(data['walk_hr_bpm']))

        if 'resting_hr_bpm' in data and acct.hr_max is not None:
            # HR fraction method
            # https://www.trailrunnerworld.com/vo2-max-calculator/
            self.vo2_max = 15.3 * acct.hr_max / float(data['resting_hr_bpm'])
