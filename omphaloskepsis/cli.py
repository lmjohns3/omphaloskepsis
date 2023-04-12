import bcrypt
import click
import os
import re

from .accounts import Account, Password


def _expand(s):
    return os.path.abspath(os.path.expandvars(os.path.expanduser(s)))

@click.group()
@click.option('--db', default='', metavar='FILE',
              help='Use database stored in FILE.')
@click.pass_context
def cli(ctx, db):
    ctx.obj = dict(db=_expand(db or os.environ.get('OMPHALOSKEPSIS_DB', '')))


def _init_account(sess, email):

    def parse_date(s):
        if not re.match(r'[12]\d\d\d-\d\d?-\d\d?', s):
            raise click.Abort()
        return s

    def parse_sex(s):
        if s.lower() not in 'mfo':
            raise click.Abort()
        return s.upper()

    print(f'-- Adding account {email} --')
    name = click.prompt(f'Display name for {email}')
    raw_password = click.prompt(
        f'Password for {email}', hide_input=True, confirmation_prompt=True)
    hashed_password = bcrypt.hashpw(raw_password.encode('utf8'), bcrypt.gensalt())
    bday = click.prompt(f'Birthday for {email} (YYYY-MM-DD)', value_proc=parse_date)
    is_male = 'M' == click.prompt(
        f'Sex of {email} for heart-rate calculations (M/F/O)', value_proc=parse_sex)

    sess.add(Account(
        email=email,
        name=name,
        password=Password(password=hashed_password.decode('utf8')),
        birthday=bday,
        is_male=is_male))
    sess.commit()


@cli.command()
@click.option('--load', default='', metavar='FILE',
              help='Import data from FILE containing older database.')
@click.argument('account', nargs=-1)
@click.pass_context
def init(ctx, load, account):
    import sqlalchemy
    from .events import Note, Vitals
    from .spans import Span
    from .db import Model

    engine = sqlalchemy.create_engine(f'sqlite:///{ctx.obj["db"]}')
    Model.metadata.create_all(engine)
    sess = sqlalchemy.orm.sessionmaker(bind=engine, autoflush=False)()
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
@click.pass_context
def serve(ctx, host, port, config, debug, secret):
    from .serve import create_app
    create_app(
        ctx.obj['db'], debug, secret
    ).run(
        host=host, port=port, debug=debug, threaded=False, processes=1 if debug else 2
    )


if __name__ == '__main__':
    main()
