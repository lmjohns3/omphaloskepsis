import json
import sqlalchemy
import sqlalchemy.ext.associationproxy

from . import db
from .snapshots import Collection


exercise_tags = db.TagSecondary('exercise')


class Exercise(db.Model):
    __tablename__ = 'exercises'

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String, unique=True, nullable=False)
    about = db.Column(db.String)
    howto = db.Column(db.String)

    _tags = db.tag_relationship(exercise_tags, 'exercises')
    tags = db.tag_proxy()

    def to_dict(self):
        return dict(
            id=self.id,
            name=self.name,
            about=self.about,
            howto=self.howto,
            tags=sorted(self.tags)
        )


class Workout(db.Model):
    __tablename__ = 'workouts'

    id = db.Column(db.Integer, primary_key=True)

    collection_id = db.Column(
        db.Integer, db.CascadeForeignKey('collections'), unique=True, nullable=False)
    collection = db.OneToOneRelationship(Collection, 'workout')

    # A JSON string containing goals for this workout, like a list of target sets.
    goals = db.Column(db.LargeBinary)

    def to_dict(self):
        return dict(
            id=self.id,
            goals=json.loads(self.goals),
            collection_id=self.collection_id,
            sets=[s.to_dict() for s in self.sets],
        )


class Set(db.Model):
    __tablename__ = 'exercise_sets'

    id = db.Column(db.Integer, primary_key=True)

    workout_id = db.Column(db.Integer, db.CascadeForeignKey('workouts'), nullable=False)
    workout = sqlalchemy.orm.relationship(Workout, backref='sets', uselist=False)

    exercise_id = db.Column(db.Integer, db.CascadeForeignKey('exercises'), nullable=False)
    exercise = sqlalchemy.orm.relationship(Exercise, backref='sets', uselist=False)

    start_utc = db.Column(db.Integer)
    end_utc = db.Column(db.Integer)

    # Discrete wavelet encoding of heart rate R-R intervals in milliseconds.
    rr_coeffs = db.Column(db.LargeBinary)
    rr_count = db.Column(db.Integer)

    # Discrete wavelet encoding of lat/lng/alt of GPS track (e.g. for cycling).
    gps_lats = db.Column(db.LargeBinary)
    gps_lngs = db.Column(db.LargeBinary)
    gps_alts = db.Column(db.LargeBinary)
    gps_count = db.Column(db.Integer)

    # Measurements potentially reported by exercise equipment.
    reps = db.Column(db.Integer)
    resistance = db.Column(db.Float)
    distance_m = db.Column(db.Float)
    cadence_hz = db.Column(db.Float)
    avg_power_w = db.Column(db.Float)

    def update_from(self, data):
        if 'rr_coeffs' in data and 'rr_count' in data and int(data['rr_count']) > 0:
            self.rr_coeffs = data['rr_coeffs']
            self.rr_count = int(data['rr_count'])

        if 'gps_lats' in data and 'gps_lngs' in data and int(data['gps_count']) > 0:
            self.gps_lats = data['gps_lats']
            self.gps_lngs = data['gps_lngs']
            self.gps_alts = data.get('gps_alts')
            self.gps_count = int(data['gps_count'])

        def validate(attr, build, validate):
            if attr in data:
                value = build(data[attr])
                if validate(value):
                    setattr(self, attr, value)

        validate('end_utc', int, lambda v: v > 0)
        validate('reps', int, lambda v: v > 0)
        validate('resistance', float, lambda v: v > 0)
        validate('distance_m', float, lambda v: v > 0)
        validate('cadence_hz', float, lambda v: v > 0)
        validate('avg_power_w', float, lambda v: v > 0)

    def to_dict(self, complete=False):
        return dict(
            id=self.id,
            workout_id=self.workout_id,
            exercise_id=self.exercise_id,
            start_utc=self.start_utc,
            end_utc=self.end_utc,
            rr_coeffs=self.rr_coeffs,
            rr_count=self.rr_count,
            gps_lats=self.gps_lats,
            gps_lngs=self.gps_lngs,
            gps_alts=self.gps_alts,
            gps_count=self.gps_count,
            reps=self.reps,
            resistance=self.resistance,
            distance_m=self.distance_m,
            cadence_hz=self.cadence_hz,
            avg_power_w=self.avg_power_w,
        )
