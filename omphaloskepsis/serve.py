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
import time
import webauthn
import yaml
import werkzeug.middleware.proxy_fix as pfix

from .accounts import Account, Auth
from .snapshots import Collection, Snapshot

app = flask.Flask('omphaloskepsis', template_folder='static')
app.wsgi_app = pfix.ProxyFix(app.wsgi_app, x_for=1)

gdb = flask_sqlalchemy.SQLAlchemy()
bcrypt = flask_bcrypt.Bcrypt(app)
mail = flask_mail.Mail(app)
limiter = flim.Limiter(
    flim.util.get_remote_address, app=app, storage_uri='redis://127.0.0.1:6379')


# helpers

def _create_csrf_token(s):
    return hashlib.sha256(f'{time.time()}{s}'.encode('utf8')).hexdigest()


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
        acct = gdb.session.get(Account, flask.session['aid'])
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
    print(session, header)
    if flask.request.method != 'GET' and session != header:
        flask.abort(400)


# aggregate views

@app.route('/api/dashboard/', methods=['GET'])
def get_dashboard():
    req = flask.request
    snapshots = sqlalchemy.select(Snapshot).order_by(Snapshot.utc.desc()).limit(3)
    result = dict(
        snapshots=[s.to_dict() for s in req.acct.session.scalars(snapshots)],
    )
    return flask.jsonify(result)


@app.route('/api/habits/', methods=['GET'])
def get_habits():
    req = flask.request
    return _json(req.acct.session.scalars(
        sqlalchemy.select(Collection).where(Collection.flavor == 'habit')))


@app.route('/api/timeline/', methods=['GET'])
def get_timeline():
    req = flask.request
    now = time.time()
    get = lambda key, days: req.args.get(key, now + 86400 * days)
    result = dict(snapshots={
        s.id: s.to_dict() for s in
        req.acct.session.scalars(sqlalchemy.select(Snapshot).where(
            Snapshot.utc >= get('start', -90),
            Snapshot.utc <= get('end', 0),
        ))
    })
    cids = {s.get('collection_id') for s in result['snapshots'].values()}
    result['collections'] = {
        c.id: c.to_dict() for c in
        req.acct.session.scalars(sqlalchemy.select(Collection).where(Collection.id.in_(cids)))
    }
    return flask.jsonify(result)

@app.route('/api/workouts/', methods=['GET'])
def get_workouts():
    req = flask.request
    result = dict(exercises={}, workouts={})
    if app.config['config']:
        with open(app.config['config']) as handle:
            result.update(yaml.load(handle, Loader=yaml.CLoader))
    return flask.jsonify(result)


# snapshots

@app.route('/api/snapshots/', methods=['POST'])
def create_snapshot():
    req = flask.request
    snapshot = Snapshot()
    if 'flavor' in req.json:
        snapshot.collection = Collection(flavor=req.json.pop('flavor'))
    snapshot.update_from(req.json)
    req.acct.session.add(snapshot)
    req.acct.session.commit()
    return _json(snapshot)

@app.route('/api/snapshot/<int:sid>/', methods=['GET'])
def get_snapshot(sid):
    req = flask.request
    snapshot = req.acct.session.get(Snapshot, sid)
    if not snapshot:
        flask.abort(403)
    return _json(snapshot)

@app.route('/api/snapshot/<int:sid>/', methods=['POST'])
def update_snapshot(sid):
    req = flask.request
    snapshot = req.acct.session.get(Snapshot, sid)
    if not snapshot:
        flask.abort(403)
    snapshot.update_from(req.json)
    req.acct.session.commit()
    return _json(snapshot)

@app.route('/api/snapshot/<int:sid>/', methods=['DELETE'])
def delete_snapshot(sid):
    req = flask.request
    snapshot = req.acct.session.get(Snapshot, sid)
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
    req.acct.session.add(collection)
    req.acct.session.commit()
    return _json(collection)

@app.route('/api/collection/<int:cid>/', methods=['GET'])
def get_collection(cid):
    req = flask.request
    collection = req.acct.session.get(Collection, cid)
    snapshots = req.acct.session.scalars(sqlalchemy.select(Snapshot).where(Snapshot.collection_id == cid))
    if not collection:
        flask.abort(403)
    return flask.jsonify(dict(
        collection=collection.to_dict(),
        snapshots=[s.to_dict() for s in snapshots],
    ))

@app.route('/api/collection/<int:cid>/', methods=['POST'])
def update_collection(cid):
    req = flask.request
    collection = req.acct.session.get(Collection, cid)
    if not collection:
        flask.abort(403)
    collection.update_from(req.json)
    req.acct.session.commit()
    return _json(collection)

@app.route('/api/collection/<int:cid>/', methods=['DELETE'])
def delete_collection(cid):
    req = flask.request
    collection = req.acct.session.get(Collection, cid)
    if not collection:
        flask.abort(403)
    req.acct.session.delete(collection)
    req.acct.session.commit()
    return flask.jsonify({})


# account

@app.route('/api/account/', methods=['GET'])
def get_account():
    return _json(flask.request.acct)

@app.route('/api/account/', methods=['POST'])
def update_account():
    req = flask.request
    req.acct.update_from(req.json)
    gdb.session.commit()
    return _json(req.acct)

@app.route('/api/account/', methods=['DELETE'])
def delete_account():
    gdb.session.delete(flask.request.acct)
    gdb.session.commit()
    return flask.jsonify({})


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

    auth = gdb.session.scalar(sqlalchemy.select(Auth).where(
        Auth.email == req.json['email'],
        Auth.validated_utc > 0,
        Auth.blocked_utc < 0,
    ))
    if not auth:
        flask.abort(404)

    if 'password' not in req.json:
        flask.abort(400)

    if not bcrypt.check_password_hash(auth.password, req.json['password']):
        auth.last_failure_utc = time.time()
        auth.failures_since_success += 1
        gdb.session.commit()
        flask.abort(403)

    auth.last_success_utc = time.time()
    auth.failures_since_success = 0
    gdb.session.commit()

    flask.session['aid'] = auth.account_id
    flask.session['csrf'] = _create_csrf_token(auth.account_id)
    return flask.jsonify(dict(
        aid=flask.session['aid'],
        csrf=flask.session['csrf'],
    ))


@app.route('/api/logout/', methods=['POST'])
def logout():
    del flask.session['aid']
    flask.session['csrf'] = _create_csrf_token(secrets.token_hex(8))
    return flask.jsonify(dict(csrf=flask.session['csrf']))


@app.route('/')
@app.route('/<path:path>/')
def index(path=''):
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
    app.config['SESSION_COOKIE_SAMESITE'] = 'Strict'
    app.config['SESSION_COOKIE_DOMAIN'] = domain
    app.config['PERMANENT_SESSION_LIFETIME'] = 12 * 3600
    flask_sessions.Session().init_app(app)

    app.config['SQLALCHEMY_ECHO'] = debug
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db}'
    gdb.init_app(app)

    app.config['config'] = config_path
    app.config['root'] = os.path.dirname(db)
    return app
