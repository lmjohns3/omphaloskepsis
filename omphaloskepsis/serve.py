import collections
import flask
import flask_bcrypt
import flask_sessions
import flask_sqlalchemy
import hashlib
import json
import secrets
import time
import webauthn
import yaml

from .accounts import Account, Email
from .snapshots import Collection, Snapshot
from .workouts import Exercise, Set, Workout

app = flask.Flask('omphaloskepsis', template_folder='static')
bcrypt = flask_bcrypt.Bcrypt(app)
sql = flask_sqlalchemy.SQLAlchemy()


# helpers

def _create_csrf_token(s):
    return hashlib.sha256(
        f'{app.config["SECRET_KEY"]}{time.time()}{s}'.encode('utf8')
    ).hexdigest()


def _json(items):
    try:
        return flask.jsonify([item.to_dict() for item in items])
    except:
        return flask.jsonify(items.to_dict())


@app.before_request
def _is_api_request_ok():
    req = flask.request.url
    if req.startswith('/api/'):
        if not ('aid' in flask.session or req == '/api/login/'):
            flask.abort(401)
        if flask.request.method != 'GET':
            if 'csrf' not in flask.session:
                flask.abort(400)
            if 'x-omphaloskepsis-csrf' not in flask.request.headers:
                flask.abort(400)
            if flask.session['csrf'] != flask.request.headers['x-omphaloskepsis-csrf']:
                flask.abort(400)

@app.before_request
def _populate_account():
    if 'aid' in flask.session:
        account = sql.session.query(Account).filter(
            Account.id == flask.session['aid']
        ).scalar()
        if account:
            flask.request.account = account
        else:
            del flask.session['aid']


# snapshots

@app.route('/api/snapshots/', methods=['GET'])
def get_snapshots():
    now = time.time()
    get = lambda key, days: flask.request.args.get(key, now + 86400 * days)
    return _json(sql.session.query(Snapshot).filter(
        Snapshot.account == flask.request.account,
        Snapshot.utc >= get('start', -90),
        Snapshot.utc <= get('end', 0),
    ).order_by(Snapshot.utc.desc()))

@app.route('/api/snapshots/', methods=['POST'])
def create_snapshot():
    snapshot = Snapshot(account=flask.request.account)
    snapshot.update_from(flask.request.json)
    sql.session.add(snapshot)
    sql.session.commit()
    return flask.jsonify(dict(id=snapshot.id))

@app.route('/api/snapshot/<id>/', methods=['GET'])
def get_snapshot(id):
    snapshot = sql.session.query(Snapshot).filter(
        Snapshot.account == flask.request.account,
        Snapshot.id == id,
    ).scalar()
    if not snapshot:
        flask.abort(403)
    return _json(snapshot)

@app.route('/api/snapshot/<id>/', methods=['POST'])
def update_snapshot(id):
    snapshot = sql.session.query(Snapshot).filter(
        Snapshot.account == flask.request.account,
        Snapshot.id == id,
    ).scalar()
    if not snapshot:
        flask.abort(403)
    snapshot.update_from(flask.request.json)
    sql.session.commit()
    return _json(snapshot)

@app.route('/api/snapshot/<id>/', methods=['DELETE'])
def delete_snapshot(id):
    snapshot = sql.session.query(Snapshot).filter(
        Snapshot.account == flask.request.account,
        Snapshot.id == id,
    ).scalar()
    if not snapshot:
        flask.abort(403)
    sql.session.delete(snapshot)
    sql.session.commit()
    return flask.jsonify({})


# collections

@app.route('/api/collections/', methods=['POST'])
def create_collection():
    collection = Collection()
    collection.update_from(flask.request.json)
    snapshot = Snapshot(account=flask.request.account, collection=collection)
    snapshot.update_from(flask.request.json)
    sql.session.add(snapshot)
    sql.session.commit()
    return flask.jsonify(dict(id=collection.id))

@app.route('/api/collection/<id>/', methods=['GET'])
def get_collection(id):
    collection = sql.session.query(Collection).join(Snapshot).filter(
        Snapshot.account == flask.request.account,
        Collection.id == id,
    ).scalar()
    if not collection:
        flask.abort(403)
    return _json(collection)

@app.route('/api/collection/<id>/', methods=['POST'])
def update_collection(id):
    collection = sql.session.query(Collection).join(Snapshot).filter(
        Snapshot.account == flask.request.account,
        Collection.id == id,
    ).scalar()
    if not collection:
        flask.abort(403)
    collection.update_from(flask.request.json)
    sql.session.commit()
    return _json(collection)

@app.route('/api/collection/<id>/', methods=['DELETE'])
def delete_collection(id):
    collection = sql.session.query(Collection).join(Snapshot).filter(
        Snapshot.account == flask.request.account,
        Collection.id == id,
    )
    if not collection:
        flask.abort(403)
    sql.session.delete(collection)
    sql.session.commit()
    return flask.jsonify({})


# exercise

@app.route('/api/workouts/', methods=['POST'])
def create_workout():
    collection = Collection()
    collection.update_from(flask.request.json)
    snapshot = Snapshot(account=flask.request.account, collection=collection)
    snapshot.update_from(flask.request.json)
    encoded = json.dumps(flask.request.json['goals']).encode('utf8')
    workout = Workout(collection=collection, goals=encoded)
    sql.session.add(workout)
    sql.session.commit()
    return flask.jsonify(dict(id=workout.id))

@app.route('/api/workout/<wid>/', methods=['GET'])
def get_workout(wid):
    workout = sql.session.query(Workout).filter(Workout.id == wid).scalar()
    if not workout:
        flask.abort(404)
    if workout.collection.snapshots[0].account.id != flask.session['aid']:
        flask.abort(403)
    return _json(workout)

@app.route('/api/workout/<wid>/sets/', methods=['POST'])
def create_set(wid):
    workout = sql.session.query(Workout).filter(Workout.id == wid).scalar()
    if not workout:
        flask.abort(404)
    if workout.collection.snapshots[0].account.id != flask.session['aid']:
        flask.abort(403)
    es = ExerciseSet(exercise_id=flask.request.json['exercise_id'])
    workout.sets.append(es)
    sql.session.commit()
    return _json(es)

@app.route('/api/workout/<wid>/sets/<sid>/', methods=['POST'])
def update_set(wid, sid):
    es = sql.session.query(Set).join(Workout, Snapshot).filter(Set.id == sid).scalar()
    if not es:
        flask.abort(404)
    if es.workout_id != wid:
        flask.abort(403)
    workout = sql.session.query(Workout).filter(Workout.id == wid).scalar()
    if not workout:
        flask.abort(404)
    if workout.collection.snapshots[0].account.id != flask.session['aid']:
        flask.abort(403)
    es.update_from(flask.request.json)
    sql.session.commit()
    return _json(es)

@app.route('/api/workout/<wid>/sets/<sid>/', methods=['DELETE'])
def delete_set(wid, eid):
    es = sql.session.query(Set).join(Workout, Snapshot).filter(Set.id == sid).scalar()
    if not es:
        flask.abort(404)
    if es.workout_id != wid:
        flask.abort(403)
    workout = sql.session.query(Workout).filter(Workout.id == wid).scalar()
    if not workout:
        flask.abort(404)
    if workout.collection.snapshots[0].account.id != flask.session['aid']:
        flask.abort(403)
    sql.session.delete(es)
    sql.session.commit()
    return flask.jsonify({})


# app

@app.route('/api/account/', methods=['GET'])
def get_account():
    if not getattr(flask.request, 'account', None):
        flask.abort(401)
    return _json(flask.request.account)

@app.route('/api/account/', methods=['POST'])
def update_account():
    return _json(flask.request.account)

@app.route('/api/account/', methods=['DELETE'])
def delete_account():
    sql.session.delete(flask.request.account)
    sql.session.commit()
    return flask.jsonify({})


@app.route('/api/login/', methods=['POST'])
def login():
    if 'email' not in flask.request.json:
        flask.abort(401)

    email = sql.session.query(Email).filter(
        Email.email == flask.request.json['email'],
        Email.validated_utc > 0,
    ).scalar()
    if not email:
        flask.abort(404)

    if 'password' in flask.request.json:
        if not bcrypt.check_password_hash(email.account.password.password,
                                          flask.request.json['password']):
            flask.abort(403)

        flask.session['aid'] = email.account.id
        flask.session['csrf'] = _create_csrf_token(email.account.id)
        return flask.jsonify(dict(
            account=email.account.to_dict(), csrf=flask.session['csrf']))

    flask.abort(400)


@app.route('/api/logout/', methods=['POST'])
def logout():
    del flask.session['aid']
    del flask.session['csrf']
    return flask.jsonify({})


@app.route('/api/config/', methods=['GET'])
def config():
    config = {}
    if app.config['config']:
        with open(app.config['config']) as handle:
            config.update(yaml.load(handle, Loader=yaml.CLoader))
    config['exercises'] = {e.id: e.to_dict() for e in sql.session.query(Exercise).all()}
    config['tagToIds'] = collections.defaultdict(list)
    config['nameToId'] = {}
    for ex in config['exercises'].values():
        config['nameToId'][ex['name']] = ex['id']
        for tag in ex['tags']:
            config['tagToIds'][tag].append(ex['id'])
    return flask.jsonify(config)


@app.route('/')
@app.route('/account/')
@app.route('/login/')
@app.route('/timeline/')
@app.route('/snapshot/<id>/')
@app.route('/collection/<id>/')
@app.route('/workout/<id>/')
def index(*args, **kwargs):
    if 'csrf' not in flask.session:
        flask.session['csrf'] = _create_csrf_token(secrets.token_hex(8))
    return flask.render_template('app.html')


def create_app(db, debug, secret, domain='localhost', config_path=None):
    app.config['SECRET_KEY'] = secret or secrets.token_hex(128)

    app.config['SESSION_TYPE'] = 'redis'
    app.config['SESSION_REDIS'] = 'redis://127.0.0.1:6379'
    app.config['SESSION_KEY_PREFIX'] = 'omphaloskepsis:'
    app.config['SESSION_USE_SIGNER'] = True
    app.config['SESSION_COOKIE_NAME'] = 'om'
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SECURE'] = True
    app.config['SESSION_COOKIE_DOMAIN'] = domain
    app.config['PERMANENT_SESSION_LIFETIME'] = 86400
    flask_sessions.Session().init_app(app)

    app.config['SQLALCHEMY_ECHO'] = debug
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db}'
    sql.init_app(app)

    app.config['config'] = config_path
    return app
