# 创建表单

from flask.ext.wtf import Form
from flaskckeditor import CKEditor
from wtforms import StringField, BooleanField, TextAreaField, RadioField, SubmitField, PasswordField, IntegerField
from wtforms.validators import DataRequired


class LoginForm(Form):
    account = StringField('account', validators=[DataRequired()])
    password = PasswordField('password', validators=[DataRequired()])
    remember_me = BooleanField('remember_me', default=False)


class RegisterForm(Form):
    account = StringField('account', validators=[DataRequired()])
    password = PasswordField('New Password', validators=[DataRequired()])
    confirm = PasswordField('Repeat Password')
    remember_me = BooleanField('remember_me', default=False)

class EditForm(Form):
    about_me = TextAreaField('about_me', validators=[DataRequired()])
    # age = IntegerField('age', validators=[DataRequired()])
    location = StringField('location', validators=[DataRequired()])
    job = StringField('job', validators=[DataRequired()])


class PostForm(Form):
    title = StringField('title', validators=[DataRequired()])
    body = TextAreaField('body')
    submit = SubmitField('submit')


class CollectionForm(Form):
    title = StringField('collection', validators=[DataRequired()])
    description = StringField("description", validators=[])


class StarForm(Form):
    star = RadioField('star', coerce=int)
