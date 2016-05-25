from app import db


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    account = db.Column(db.String(64), index=True, unique=True)
    password = db.Column(db.String(64))
    posts = db.relationship('Post', backref='author', lazy='dynamic')

    # openid auth
    def is_authenticated(self):
        return True

    def is_active(self):
        return True

    def is_anonymous(self):
        return False

    def get_id(self):
        return str(self.id)

    def __repr__(self):
        return '<User %r>' % self.account


class Post(db.Model):
    id = db.Column('id', db.Integer, primary_key=True)
    body = db.Column('body', db.String(140))
    timestamp = db.Column('timestamp', db.DateTime)
    user_id = db.Column('user_id', db.Integer, db.ForeignKey('user.id'))

    def __repr__(self):
        return '<Post %r>' % self.body
