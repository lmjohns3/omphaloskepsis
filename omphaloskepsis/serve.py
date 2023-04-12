import flask
import flask_bcrypt
import flask_sessions
import flask_sqlalchemy
import hashlib
import pendulum
import secrets
import time
import uuid
import webauthn
import yaml

from .accounts import Account
from .events import Event
from .spans import Span

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
    if flask.request.url.startswith('/api/v1/'):
        if ('auid' not in flask.session or
            'csrf' not in flask.session or
            'x-omphaloskepsis-csrf' not in flask.request.headers or
            flask.session['csrf'] != flask.request.headers['x-omphaloskepsis-csrf']):
            flask.abort(401)
    if 'auid' in flask.session:
        flask.request.account = sql.session.query(Account).filter(
            Account.uid == flask.session['auid']
        ).one()


# events

@app.route('/api/v1/events/', methods=['GET'])
def get_events():
    now = time.time()
    get = lambda key, days: flask.request.args.get(key, now + 86400 * days)
    return _json(sql.session.query(Event).filter(
        Event.account == flask.request.account,
        Event.utc >= get('start', -90),
        Event.utc <= get('end', 0),
    ).order_by(Event.utc.desc()))

@app.route('/api/v1/events/', methods=['POST'])
def create_event():
    event = Event.create_from_request(flask.request)
    if 'span' in flask.request.json:
        event.span = sql.session.query(Span).filter(
            Span.account == flask.request.account,
            Span.uid == flask.request.json['span'],
        ).one()
    sql.session.add(event)
    sql.session.commit()
    return _json(event)

@app.route('/api/v1/events/<uid>/', methods=['GET'])
def get_event(uid):
    return _json(sql.session.query(Event).filter(
        Event.account == flask.request.account,
        Event.uid == uid,
    ).one())

@app.route('/api/v1/events/<uid>/', methods=['POST'])
def update_event(uid):
    event = sql.session.query(Event).filter(
        Event.account == flask.request.account,
        Event.uid == uid,
    ).one()
    event.update_from(flask.request.json)
    sql.session.commit()
    return _json(event)

@app.route('/api/v1/events/<uid>/', methods=['DELETE'])
def delete_event(uid):
    sql.session.query(Event).filter(
        Event.account == flask.request.account,
        Event.uid == uid,
    ).delete()
    sql.session.commit()
    return _json({})


# spans

@app.route('/api/v1/spans/<uid>/', methods=['GET'])
def get_span(uid):
    return _json(sql.session.query(Span).filter(
        Span.account == flask.request.account,
        Span.uid == uid,
    ).one())

@app.route('/api/v1/spans/<uid>/events/', methods=['GET'])
def get_span_events(uid):
    return _json(sql.session.query(Event).filter(
        Event.account == flask.request.account,
    ).join(Span).filter(Span.uid == uid).all())

@app.route('/api/v1/spans/', methods=['POST'])
def create_span():
    span = Span.create_from_request(flask.request)
    span.events.append(Event.create_from_request(flask.request))
    sql.session.add(span)
    sql.session.commit()
    return _json(span)

@app.route('/api/v1/spans/<uid>/', methods=['DELETE'])
def delete_span(uid):
    sql.session.query(Span).filter(
        Span.account == flask.request.account,
        Span.uid == uid,
    ).delete()
    sql.session.commit()
    return 'ok'


# app

@app.route('/api/v1/config/', methods=['GET'])
def config():
    with open(app.config['config']) as handle:
        parsed = yaml.load(handle, Loader=yaml.CLoader)
    return flask.jsonify(parsed)


@app.route('/login/', methods=['GET', 'POST'])
def login():
    if not flask.request.form:
        flask.session['csrf'] = _create_csrf_token(secrets.token_hex(8))
        return flask.render_template('login.html')

    if ('csrf' not in flask.request.form or
        'csrf' not in flask.session or
        flask.session['csrf'] != flask.request.form['csrf']):
        flask.abort(401)

    if ('email' in flask.request.form and
        'password' in flask.request.form):
        account = sql.session.query(Account).filter(
            Account.email == flask.request.form['email'],
        ).scalar()
        if account:
            password = flask.request.form['password']
            if bcrypt.check_password_hash(account.password.password, password):
                flask.session['csrf'] = _create_csrf_token(account.uid)
                flask.session['auid'] = account.uid
                return flask.redirect(flask.request.args.get('then', '/'))

    flask.abort(403)


@app.route('/logout/')
def logout():
    del flask.session['auid']
    del flask.session['csrf']
    return flask.redirect('/login/')


@app.route('/')
@app.route('/account/')
@app.route('/timeline/')
@app.route('/event/<uid>/')
@app.route('/sleep/<uid>/')
@app.route('/workout/<uid>/')
def index(*args, **kwargs):
    if 'auid' not in flask.session:
        return flask.redirect(f'/login/?then={flask.request.full_path}')
    return flask.render_template('app.html')


def create_app(db, debug, secret):
    app.config['SECRET_KEY'] = secret or secrets.token_hex(128)

    app.config['SESSION_TYPE'] = 'redis'
    app.config['SESSION_REDIS'] = 'redis://127.0.0.1:6379'
    app.config['SESSION_KEY_PREFIX'] = 'omphaloskepsis:'
    app.config['SESSION_USE_SIGNER'] = True
    app.config['SESSION_COOKIE_NAME'] = 'om'
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SECURE'] = not debug
    app.config['PERMANENT_SESSION_LIFETIME'] = 86400
    flask_sessions.Session().init_app(app)

    app.config['SQLALCHEMY_ECHO'] = debug
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db}'
    sql.init_app(app)

    app.config['config'] = config
    return app
