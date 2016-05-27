from flask import render_template, flash, redirect, g, url_for, session, request
from app import app, db
from .forms import LoginForm, EditForm, PostForm

from app import lm, models
from .models import User, Post
from flask.ext.login import login_user, current_user, logout_user, login_required

from datetime import datetime
from config import POSTS_PER_PAGE


@app.route('/hello')
def hello():
    return render_template("hello.html")


@app.route('/')
@app.route('/index', methods=['GET', 'POST'])
@app.route('/index/<int:page>', methods=['GET', 'POST'])
@login_required
def index(page=1):
    user = g.user
    form = PostForm()
    if form.validate_on_submit():
        post = Post(body=form.post.data, timestamp=datetime.utcnow(), author=g.user)
        db.session.add(post)
        db.session.commit()
        flash('Your post is now live!')
        return redirect('/index')
    posts = g.user.followed_posts().paginate(page, POSTS_PER_PAGE, False)
    return render_template("index.html", title="Home", user=user, form=form, posts=posts)


# remove openid
@app.route('/login', methods=['GET', 'POST'])
def login():
    # make sure if user is logined
    # if g.user is not None:
    #     return redirect(('/index'))
    form = LoginForm()
    if form.validate_on_submit():
        u = models.User.query.filter_by(account=form.account.data).first()
        print(u)
        if u is not None:
            flash('account is already used!')
            return redirect(url_for('login'))
        if len(form.password.data) < 6:
            flash('password is too short!')
            return redirect(url_for('login'))
        session['remember_me'] = form.remember_me.data
        new_user = models.User(account=form.account.data, password=form.password.data)
        db.session.add(new_user)
        db.session.commit()
        flash('Login Successed ! Your account is"' + form.account.data + '",remember me =' + str(form.remember_me.data))
        g.user = new_user
        # 使自己成为自己的关注者
        db.session.add(g.user.follow(g.user))
        db.session.commit()
        login_user(new_user)
        return redirect('/index')
    return render_template("login.html", title='Sign in', form=form)


@lm.user_loader
def load_user(id):
    return User.query.get(int(id))


@app.route('/logout')
def logout():
    logout_user()
    return redirect('/index')


@app.route('/user/<account>')
@app.route('/user/<account>/<int:page>')
@login_required
def user(account, page=1):
    user = User.query.filter_by(account=account).first()
    if user == None:
        flash('User ' + account + " not found.")
        return redirect('/index')
    posts = user.posts.paginate(page, POSTS_PER_PAGE, False)
    return render_template('user.html', user=user, posts=posts)


@app.route('/edit', methods=['GET', 'POST'])
@login_required
def edit():
    form = EditForm()
    if form.validate_on_submit():
        g.user.about_me = form.about_me.data
        db.session.add(g.user)
        db.session.commit()
        flash("Your changes have been saved.")
        return redirect(url_for('edit'))
    else:
        form.about_me.data = g.user.about_me
    return render_template('edit.html', form=form)


@app.errorhandler(404)
def internal_error(error):
    return render_template('404.html'), 404


@app.errorhandler(500)
def interal_error(error):
    db.session.rollback()
    return render_template('500.html'), 500


@app.route('/follow/<account>')
@login_required
def follow(account):
    user = User.query.filter_by(account=account).first()
    if user is None:
        flash('User %s not found.' % account)
        return redirect('/index')
    if user == g.user:
        flash('You can\'t follow yourself!')
        return redirect(url_for('user', account=account))
    u = g.user.follow(user)
    if u is None:
        flash('Cannot follow ' + account + '.')
        return redirect(url_for('user', account=account))
    db.session.add(u)
    db.session.commit()
    flash('You are now following ' + account + '!')
    return redirect(url_for('user', account=account))


@app.route('/unfollow/<account>')
@login_required
def unfollow(account):
    user = User.query.filter_by(account=account).first()
    if user is None:
        flash('User %s not found.' % account)
        return redirect('/index')
    if user == g.user:
        flash('You can\'t unfollow yourself!')
        return redirect(url_for('user', account=account))
    u = g.user.unfollow(user)
    if u is None:
        flash('Cannot unfollow ' + account + '.')
        return redirect(url_for('user', account=account))
    db.session.add(u)
    db.session.commit()
    flash('You have stopped following ' + account + '.')
    return redirect(url_for('user', account=account))

# @oid.after_login
# def after_login(resp):
#     if resp.email is None or resp.email == "":
#         flash('Invalid login. Please try again.')
#         return redirect(url_for('login'))
#     user = User.query.filter_by(email=resp.email).first()
#     if user is None:
#         nickname = resp.nickname
#         if nickname is None or nickname == "":
#             nickname = resp.email.split('@')[0]
#         user = User(nickname=nickname, email=resp.email)
#         db.session.add(user)
#         db.session.commit()
#     remember_me = False
#     if 'remember_me' in session:
#         remember_me = session['remember_me']
#         session.pop('remember_me', None)
#     login_user(user, remember=remember_me)
#     return redirect(request.args.get('next') or url_for('index'))


@app.before_request
def before_request():
    g.user = current_user
    if g.user.is_authenticated():
        g.user.last_seen = datetime.utcnow()
        db.session.add(g.user)
        db.session.commit()
