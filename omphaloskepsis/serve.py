import collections
import flask
import flask_bcrypt
import flask_limiter as flim
import flask_mail
import flask_sessions
import flask_sqlalchemy
import hashlib
import json
import os
import secrets
import sqlalchemy
import sqlalchemy.orm
import time
import webauthn
import yaml
import werkzeug.middleware.proxy_fix as pfix

from .accounts import Account, Auth
from .snapshots import Collection, Snapshot
from .workouts import Exercise, Set, Workout

app = flask.Flask('omphaloskepsis', template_folder='static')
app.wsgi_app = pfix.ProxyFix(app.wsgi_app, x_for=1)

gdb = flask_sqlalchemy.SQLAlchemy()
bcrypt = flask_bcrypt.Bcrypt(app)
mail = flask_mail.Mail(app)
limiter = flim.Limiter(flim.util.get_remote_address, app=app, storage_uri='redis://127.0.0.1:6379')


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
def _populate_account():
    req = flask.request
    req.acct = None
    if 'aid' in flask.session:
        acct = gdb.session.query(Account).get(flask.session['aid'])
        if acct:
            acct.open_db(app.config['root'], app.config['SQLALCHEMY_ECHO'])
            req.acct = acct
        else:
          del flask.session['aid']


@app.before_request
def _is_api_request_ok():
    if flask.request.path.startswith('/api/login'):
        return
    if flask.request.path.startswith('/api/') and 'aid' not in flask.session:
        flask.abort(401)


@app.before_request
def _check_csrf():
    session = flask.session.get('csrf', 0)
    header = flask.request.headers.get('x-omphaloskepsis-csrf', 1)
    if flask.request.method != 'GET' and session != header:
        flask.abort(400)


# snapshots

@app.route('/api/snapshots/', methods=['GET'])
def get_snapshots():
    req = flask.request
    now = time.time()
    get = lambda key, days: req.args.get(key, now + 86400 * days)
    return _json(req.acct.session.query(Snapshot).filter(
        Snapshot.utc >= get('start', -90),
        Snapshot.utc <= get('end', 0),
    ).order_by(Snapshot.utc.desc()))

@app.route('/api/snapshots/', methods=['POST'])
def create_snapshot():
    req = flask.request
    snapshot = Snapshot()
    snapshot.update_from(req.json)
    req.acct.session.add(snapshot)
    req.acct.session.commit()
    return flask.jsonify(dict(id=snapshot.id))

@app.route('/api/snapshot/<id>/', methods=['GET'])
def get_snapshot(id):
    req = flask.request
    snapshot = req.acct.session.query(Snapshot).filter(Snapshot.id == id).scalar()
    if not snapshot:
        flask.abort(403)
    return _json(snapshot)

@app.route('/api/snapshot/<id>/', methods=['POST'])
def update_snapshot(id):
    req = flask.request
    snapshot = req.acct.session.query(Snapshot).filter(Snapshot.id == id).scalar()
    if not snapshot:
        flask.abort(403)
    snapshot.update_from(req.json)
    req.acct.session.commit()
    return _json(snapshot)

@app.route('/api/snapshot/<id>/', methods=['DELETE'])
def delete_snapshot(id):
    req = flask.request
    snapshot = req.acct.session.query(Snapshot).filter(Snapshot.id == id).scalar()
    if not snapshot:
        flask.abort(403)
    req.acct.session.delete(snapshot)
    req.acct.session.commit()
    return flask.jsonify({})


# collections

@app.route('/api/collections/', methods=['POST'])
def create_collection():
    req = flask.request
    collection = Collection()
    collection.update_from(req.json)
    snapshot = Snapshot(collection=collection)
    snapshot.update_from(req.json)
    req.acct.session.add(snapshot)
    req.acct.session.commit()
    return _json(collection)

@app.route('/api/collection/<id>/', methods=['GET'])
def get_collection(id):
    req = flask.request
    collection = req.acct.session.query(Collection).filter(Collection.id == id).scalar()
    if not collection:
        flask.abort(403)
    return _json(collection)

@app.route('/api/collection/<id>/', methods=['POST'])
def update_collection(id):
    req = flask.request
    collection = req.acct.session.query(Collection).filter(Collection.id == id).scalar()
    if not collection:
        flask.abort(403)
    collection.update_from(req.json)
    req.acct.session.commit()
    return _json(collection)

@app.route('/api/collection/<id>/', methods=['DELETE'])
def delete_collection(id):
    req = flask.request
    collection = req.acct.session.query(Collection).filter(Collection.id == id).scalar()
    if not collection:
        flask.abort(403)
    req.acct.session.delete(collection)
    req.acct.session.commit()
    return flask.jsonify({})


# exercise

@app.route('/api/workouts/', methods=['POST'])
def create_workout():
    req = flask.request
    collection = Collection()
    collection.update_from(req.json)
    snapshot = Snapshot(collection=collection)
    snapshot.update_from(req.json)
    workout = Workout(collection=collection)
    for goal in req.json['goals']:
        workout.sets.append(
            Set(exercise_id=goal['id'],
                target_repetitions=goal.get('repetitions'),
                target_resistance=goal.get('resistance'),
                target_distance_m=goal.get('distance_m'),
                target_duration_s=goal.get('duration_s')))
    req.acct.session.add(workout)
    req.acct.session.commit()
    return flask.jsonify(dict(id=workout.id))

@app.route('/api/workout/<wid>/', methods=['GET'])
def get_workout(wid):
    req = flask.request
    workout = req.acct.session.query(Workout).filter(Workout.id == wid).scalar()
    if not workout:
        flask.abort(404)
    return _json(workout)

@app.route('/api/workout/<wid>/set/<sid>/', methods=['POST'])
def update_set(wid, sid):
    req = flask.request
    workout = req.acct.session.query(Workout).filter(Workout.id == wid).scalar()
    for es in workout.sets if workout else ():
        if es.id == int(sid):
            es.update_from(req.json)
            req.acct.session.commit()
            return _json(es)
    flask.abort(404)


# account

@app.route('/api/account/', methods=['GET'])
def get_account():
    req = flask.request
    if not req.acct:
        flask.abort(401)
    return _json(flask.request.account)

@app.route('/api/account/', methods=['POST'])
def update_account():
    req = flask.request
    req.acct.update_from(req.json)
    gdb.session.commit()
    return _json(req.acct)

@app.route('/api/account/', methods=['DELETE'])
def delete_account():
    req = flask.request
    req.acct.session.close()
    os.unlink(os.path.join(app.config['root'], *req.acct.path_components))
    gdb.session.delete(req.acct)
    gdb.session.commit()
    return flask.jsonify({})

@app.route('/api/config/', methods=['GET'])
def get_config():
    req = flask.request
    config = {}
    if app.config['config']:
        with open(app.config['config']) as handle:
            config.update(yaml.load(handle, Loader=yaml.CLoader))
    config['exercises'] = {e.id: e.to_dict() for e in req.acct.session.query(Exercise).all()}
    config['tagToIds'] = collections.defaultdict(list)
    config['nameToId'] = {}
    for ex in config['exercises'].values():
        config['nameToId'][ex['name']] = ex['id']
        for tag in ex['tags']:
            config['tagToIds'][tag].append(ex['id'])
    return flask.jsonify(config)


# signup

SIGNUP_EMAIL_BODY = '''\
Hello {email} -

Thanks for signing up!

Before you can get started, please confirm that you own this email
address by vising the following link:

  https://{domain}/confirm/{email64}/{code}/

Thanks!
'''

@app.route('/api/register/', methods=['POST'])
def register():
    req = flask.request

    if 'email' not in req.json:
        flask.abort(401)

    email = req.json['email']
    code = secrets.token_hex()
    domain = app.config['SESSION_COOKIE_DOMAIN']
    mail.send(flask_mail.Message(
        sender=f'noreply@{domain}',
        recipients=[email],
        subject='Please confirm your email address',
        body=SIGNUP_EMAIL_BODY.format(
            code=code,
            domain=domain,
            email=email,
            email64=base64.urlsafe_b64encode(email.encode('utf8')).strip(b'='),
        )))

    account = Account(auth=Auth(email=email,
                                validation_code=code,
                                password=req.json.get('password')))

    gdb.session.add(account)
    gdb.session.commit()

    account.create_db(app.config['root'])

    return _json({})


# session

@app.route('/api/token/', methods=['POST'])
def token():
    return flask.jsonify(dict(aid=flask.session['aid'], csrf=flask.session['csrf']))


@app.route('/api/login/', methods=['POST'])
def login():
    req = flask.request

    if 'email' not in req.json:
        flask.abort(401)

    auth = gdb.session.query(Auth).filter(
        Auth.email == req.json['email'],
        Auth.validated_utc > 0,
        Auth.blocked_utc < 0,
    ).scalar()
    if not auth:
        flask.abort(404)

    if 'password' in req.json:
        if not bcrypt.check_password_hash(auth.password, req.json['password']):
            flask.abort(403)

        auth.last_success_utc = time.time()
        auth.failures_since_success = 0
        gdb.session.commit()

        flask.session['aid'] = auth.account.id
        flask.session['csrf'] = _create_csrf_token(auth.account.id)
        return flask.jsonify(dict(aid=flask.session['aid'], csrf=flask.session['csrf']))

    flask.abort(400)


@app.route('/api/logout/', methods=['POST'])
def logout():
    del flask.session['aid']
    del flask.session['csrf']
    return flask.jsonify({})


@app.route('/')
@app.route('/account/')
@app.route('/collection/<id>/')
@app.route('/confirm/')
@app.route('/login/')
@app.route('/signup/')
@app.route('/snapshot/<id>/')
@app.route('/timeline/')
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
    app.config['PERMANENT_SESSION_LIFETIME'] = 12 * 3600
    flask_sessions.Session().init_app(app)

    app.config['SQLALCHEMY_ECHO'] = debug
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db}'
    gdb.init_app(app)

    app.config['config'] = config_path
    app.config['root'] = os.path.dirname(db)
    return app
