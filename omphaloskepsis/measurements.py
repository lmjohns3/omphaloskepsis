import json
import zlib

from . import db

Model = db.declarative_base()

def compress_json(obj):
    return zlib.compress(json.dumps(obj).encode('utf8'))

def decompress_json(compressed):
    try:
        return json.loads(zlib.decompress(compressed).decode('utf8'))
    except:
        return {}

def update_json(compressed, updates, allowed_strings):
    if not updates:
        return compressed
    current = decompress_json(compressed)
    for key, value in updates.items():
        if value is None:
            if key in current:
                del current[key]
        elif isinstance(value, (bool, int, float)):
            current[key] = value
        elif isinstance(value, str) and key in allowed_strings:
            current[key] = value
    return compress_json(current)


class Profile(Model):
    __tablename__ = 'profiles'

    STRINGS = frozenset(['name', 'birthday'])

    id = db.Column(db.Integer, primary_key=True)

    kv = db.Column(db.LargeBinary)

    def update_from(self, data):
        self.kv = db.update_json(self.kv, data, Profile.STRINGS)

    def to_dict(self):
        return dict(kv=db.decompress_json(self.kv))


class Collection(Model):
    __tablename__ = 'collections'

    STRINGS = frozenset(('goals',))

    id = db.Column(db.Integer, primary_key=True)

    flavor = db.Column(db.String, index=True, nullable=False)

    kv = db.Column(db.LargeBinary)

    def update_from(self, data):
        if data.get('flavor', '').lower() in ('habit', 'sleep', 'workout'):
            self.flavor = data.pop('flavor').lower()
        self.kv = db.update_json(self.kv, data, Collection.STRINGS)

    def to_dict(self):
        return dict(
            id=self.id,
            flavor=self.flavor,
            kv=db.decompress_json(self.kv),
            snapshot_ids=[s.id for s in self.snapshots],
        )


class Snapshot(Model):
    __tablename__ = 'snapshots'

    STRINGS = frozenset((
        'note',
        'gps_lats',
        'gps_lngs',
        'gps_alts',
        'gps_times',
        'rr_intervals',
        'step_intervals',
    ))

    id = db.Column(db.Integer, primary_key=True)

    collection_id = db.Column(
        db.Integer, db.ForeignKey('collections.id', onupdate='CASCADE', ondelete='SET NULL'))
    collection = db.relationship(
        Collection, backref='snapshots', lazy='selectin', uselist=False)

    utc = db.Column(db.Integer, index=True, nullable=False)
    tz = db.Column(db.String)

    lat = db.Column(db.Float)
    lng = db.Column(db.Float)

    kv = db.Column(db.LargeBinary)

    def update_from(self, data):
        for attr in 'utc tz lat lng collection_id'.split():
            if attr in data:
                setattr(self, attr, data.pop(attr))
        self.kv = db.update_json(self.kv, data, Snapshot.STRINGS)

    def to_dict(self):
        return dict(
            id=self.id,
            utc=self.utc,
            tz=self.tz,
            lat=self.lat,
            lng=self.lng,
            collection_id=self.collection_id,
            kv=db.decompress_json(self.kv),
        )
