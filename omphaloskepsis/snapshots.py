import pendulum
import re
import sqlalchemy

from . import db
from .accounts import Account


collection_tags = db.TagSecondary('collection')

class Collection(db.Model):
    __tablename__ = 'collections'

    id = db.Column(db.Integer, primary_key=True)

    _tags = db.tag_relationship(collection_tags, 'collections')
    tags = db.tag_proxy()

    def update_from(self, data):
        db.update_tags(self, data.get('tags', ()))

    def to_dict(self):
        return dict(
            id=self.id,
            tags=sorted(self.tags),
            snapshot_ids=[s.id for s in self.snapshots],
            workout_id=self.workout.id if self.workout else None,
        )


class Snapshot(db.Model):
    __tablename__ = 'snapshots'

    id = db.Column(db.Integer, primary_key=True)

    account_id = db.Column(db.Integer, db.CascadeForeignKey('accounts'), nullable=False)
    account = sqlalchemy.orm.relationship(Account, backref='snapshots', uselist=False)

    # Unix timestamp and local time zone.
    utc = db.Column(db.Integer, index=True, nullable=False)
    tz = db.Column(db.String)

    # Geographic location.
    lat = db.Column(db.Float, index=True)
    lng = db.Column(db.Float, index=True)

    # Text annotation.
    note = db.Column(db.Text)

    # Physical state.
    height_cm = db.Column(db.Float)
    weight_kg = db.Column(db.Float)
    body_temp_degc = db.Column(db.Float)
    heart_rate_bpm = db.Column(db.Float)
    blood_pressure_mmhg = db.Column(db.Float)  # Stored as 1000 * systolic + diastolic.
    blood_oxygen_spo2_pct = db.Column(db.Float)
    vo2_max_ml_kg_min = db.Column(db.Float)
    glucose_mmol_l = db.Column(db.Float)
    lactate_mmol_l = db.Column(db.Float)

    # Emotional state. Range: (not present) 0 <---> 1 (fully present)
    happy = db.Column(db.Float)
    sad = db.Column(db.Float)
    angry = db.Column(db.Float)
    afraid = db.Column(db.Float)
    mood = db.Column(db.Float)  # Overall mood: negative (-1) <---> (+1) positive.

    collection_id = db.Column(db.Integer, db.CascadeForeignKey('collections'))
    collection = sqlalchemy.orm.relationship(
        Collection, backref='snapshots', lazy='selectin', uselist=False)

    @property
    def bmi(self):
        height_m = self.height_cm / 100
        return self.weight_kg / height_m / height_m

    def update_from(self, data):
        def validate(attr, build, validate):
            if attr in data:
                value = build(data[attr])
                if validate(value):
                    setattr(self, attr, value)

        validate('utc', float, lambda v: v > 0)
        validate('tz', str, lambda v: len(v) < 80 and re.match(r'\w+/\w+', v) and pendulum.now(v))
        validate('lat', float, lambda v: -90 <= v <= 90)
        validate('lng', float, lambda v: -180 <= v <= 180)
        validate('note', str, lambda v: v)

        validate('height_cm', float, lambda v: 0 < v < 400)
        validate('weight_kg', float, lambda v: 0 < v < 1000)
        validate('body_temp_degc', float, lambda v: 0 < v < 100)
        validate('heart_rate_bpm', float, lambda v: 0 < v < 1000)
        validate('blood_pressure_mmhg', float, lambda v: 0 < v < 1000000)
        validate('blood_oxygen_spo2_pct', float, lambda v: 0 < v <= 100)
        validate('vo2_max_ml_kg_min', float, lambda v: 0 < v < 1000)
        validate('glucose_mmol_l', float, lambda v: v > 0)
        validate('lactate_mmol_l', float, lambda v: v > 0)

        validate('happy', float, lambda v: 0 <= v <= 1)
        validate('sad', float, lambda v: 0 <= v <= 1)
        validate('angry', float, lambda v: 0 <= v <= 1)
        validate('afraid', float, lambda v: 0 <= v <= 1)
        validate('mood', float, lambda v: -1 <= v <= 1)

        if 'walk_time_min' in data and 'walk_heart_rate_bpm' in data:
            time_min = float(data['walk_time_min'])
            heart_rate_bpm = float(data['walk_heart_rate_bpm'])
            if 0 < time_min < 100 and 0 < heart_rate_bpm < 1000:
                self.set_vo2_max_from_mile_hr(walk_time_min, heart_rate_bpm)

    def to_dict(self):
        return dict(
            id=self.id,
            utc=self.utc,
            tz=self.tz,
            lat=self.lat,
            lng=self.lng,
            note=self.note,
            height_cm=self.height_cm,
            weight_kg=self.weight_kg,
            vo2_max_ml_kg_min=self.vo2_max_ml_kg_min,
            heart_rate_bpm=self.heart_rate_bpm,
            blood_pressure_mmhg=self.blood_pressure_mmhg,
            body_temp_degc=self.body_temp_degc,
            happy=self.happy,
            sad=self.sad,
            angry=self.angry,
            afraid=self.afraid,
            mood=self.mood,
            collection_id=self.collection_id,
        )

    def set_vo2_max_from_resting_hr(self, heart_rate_bpm):
        # HR fraction method
        # https://www.trailrunnerworld.com/vo2-max-calculator/
        self.vo2_max_ml_kg_min = 15.3 * self.account.heart_rate_max_bpm / heart_rate_bpm

    def set_vo2_max_from_mile_hr(self, walk_time_min, walk_heart_rate_bpm):
        # Rockport method: Walk 1 mile, measure time and HR at end of walk.
        # https://www.calculatorpro.com/calculator/vo2-max-calculator/
        # http://www.shapesense.com/fitness-exercise/calculators/vo2max-calculator.shtml
        self.vo2_max_ml_kg_min = (132.8530
                                  + 6.3150 * self.account.is_male
                                  - 0.3877 * self.account.age_y
                                  - 0.1695 * self.weight_kg
                                  - 3.2649 * walk_time_min
                                  - 0.1565 * walk_heart_rate_bpm)
