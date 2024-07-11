import bcrypt
import click
import os
import re
import time
import yaml

def _expand(s):
    return os.path.abspath(os.path.expandvars(os.path.expanduser(s)))


@click.group()
@click.option('--db', default='', metavar='FILE',
              help='Use database stored in FILE.')
@click.pass_context
def cli(ctx, db):
    ctx.obj = dict(db=_expand(db or os.environ.get('OMPHALOSKEPSIS_DB', '')))


@cli.command()
@click.option('--config', metavar='FILE',
              help='Load config from FILE.')
@click.argument('emails', nargs=-1)
@click.pass_context
def init(ctx, config, emails):
    import sqlalchemy
    from . import accounts, db, measurements

    static = {}
    if config:
        with open(config) as handle:
            static.update(yaml.load(handle, Loader=yaml.CLoader))

    db_path = ctx.obj['db']
    root = os.path.dirname(db_path)
    if not os.path.isdir(root):
        os.makedirs(root)
    engine = db.engine(db_path)
    accounts.Model.metadata.create_all(engine)
    sess = db.sessionmaker(bind=engine, autoflush=False)()
    for email in emails:
        hashed = bcrypt.hashpw(
            click.prompt(
                f'Password for {email}',
                hide_input=True,
                confirmation_prompt=False,
            ).encode('utf8'),
            bcrypt.gensalt())
        account = accounts.Account()
        account.emails.append(accounts.Email(email=email, validated_utc=time.time()))
        account.passwords.append(accounts.Password(password=hashed))
        sess.add(account)
        sess.commit()
        account.create_db(root)


@cli.command()
@click.option('--host', default='localhost', metavar='HOST',
              help='Run server on HOST.')
@click.option('--port', default=5555, metavar='PORT',
              help='Run server on PORT.')
@click.option('--config', metavar='FILE',
              help='Load config from this file.')
@click.option('--debug/--no-debug', default=False)
@click.option('--secret', default='', metavar='S',
              help='Use S for a secret session key.')
@click.option('--domain', default='localhost', metavar='D',
              help='Only accept session cookies at this domain.')
@click.option('--assets', default=None, metavar='DIR',
              help='Access static / template assets from DIR.')
@click.pass_context
def serve(ctx, host, port, config, debug, secret, domain, assets):
    from .serve import create_app
    app = create_app(ctx.obj['db'],
                     debug=debug,
                     secret=secret,
                     domain=domain,
                     config_path=config,
                     assets=assets)
    if debug:
        app.run(host=host, port=port, debug=True, threaded=False, processes=1)
    else:
        import gevent.pywsgi
        gevent.pywsgi.WSGIServer((host, port), app).serve_forever()


if __name__ == '__main__':
    main()
