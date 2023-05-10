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


def _init_account(sess, email):
    from .accounts import Account, Email, Password

    password = click.prompt(
        f'Password for {email}', hide_input=True, confirmation_prompt=False)

    sess.add(Account(emails=[Email(email=email, validated_utc=time.time())],
                     password=Password(password=bcrypt.hashpw(
                         password.encode('utf8'), bcrypt.gensalt()))))
    sess.commit()


@cli.command()
@click.option('--load', default='', metavar='FILE',
              help='Import data from FILE containing older database.')
@click.option('--config', metavar='FILE',
              help='Load config from this file.')
@click.argument('account', nargs=-1)
@click.pass_context
def init(ctx, load, config, account):
    import sqlalchemy
    from . import db, snapshots, workouts

    engine = sqlalchemy.create_engine(f'sqlite:///{ctx.obj["db"]}')
    db.Model.metadata.create_all(engine)

    sess = sqlalchemy.orm.sessionmaker(bind=engine, autoflush=False)()

    if config:
        with open(config) as handle:
            static = yaml.load(handle, Loader=yaml.CLoader)
        for name, exercise in static.get('exercises', {}).items():
            sess.add(workouts.Exercise(
                name=name,
                howto=exercise.get('howto'),
                tags=set(filter(None, [exercise.get('group')]))))

    for email in account:
        _init_account(sess, email)

    sess.commit()


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
@click.pass_context
def serve(ctx, host, port, config, debug, secret, domain):
    from .serve import create_app
    create_app(
        ctx.obj['db'], debug, secret, domain=domain, config_path=config,
    ).run(
        host=host, port=port, debug=debug, threaded=False, processes=1 if debug else 2
    )


if __name__ == '__main__':
    main()
