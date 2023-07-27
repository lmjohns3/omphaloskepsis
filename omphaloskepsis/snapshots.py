from . import db

Model = db.declarative_base()


class Collection(Model):
    __tablename__ = 'collections'

    STRINGS = frozenset(('goals',))

    id = db.Column(db.Integer, primary_key=True)

    FLAVORS = frozenset(('habit', 'sleep', 'workout'))
    flavor = db.Column(db.String, index=True, nullable=False)

    kv = db.Column(db.LargeBinary)

    def update_from(self, data):
        if 'flavor' in data:
            f = data.pop('flavor')
            if f in Collection.FLAVORS:
                self.flavor = f
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
        'gps_lats', 'gps_lngs', 'gps_alts', 'gps_times',
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

    note = db.Column(db.LargeBinary)

    kv = db.Column(db.LargeBinary)

    def update_from(self, data):
        for attr in 'utc tz lat lng collection_id'.split():
            if attr in data:
                setattr(self, attr, data.pop(attr))
        if 'note' in data:
            self.note = db.compress_json(data.pop('note'))
        self.kv = db.update_json(self.kv, data, Snapshot.STRINGS)

    def to_dict(self):
        return dict(
            id=self.id,
            utc=self.utc,
            tz=self.tz,
            lat=self.lat,
            lng=self.lng,
            note=db.decompress_json(self.note) or None,
            collection_id=self.collection_id,
            kv=db.decompress_json(self.kv),
        )
