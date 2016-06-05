from flask import render_template, flash, redirect, g, url_for, session, request, make_response
from app import app, db
from .forms import LoginForm, EditForm, PostForm, CollectionForm, StarForm, RegisterForm

from app import lm, models
from .models import User, Post, Collection
from flask.ext.login import login_user, current_user, logout_user, login_required

from datetime import datetime
from config import POSTS_PER_PAGE, remap
import re, random


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
    # if form.validate_on_submit():
    #     body=re.sub(r'</?\w+[^>]*>','',form.body.data)
    # post = Post(title=form.title.data, body=body, timestamp=datetime.utcnow(), author=g.user)
    # db.session.add(post)
    # db.session.commit()
    # flash('Your post is now live!')
    # return redirect('/index')
    posts = g.user.followed_posts().paginate(page, POSTS_PER_PAGE, False)
    for post in posts.items:
        post.body = re.sub(r'</?\w+[^>]*>', '', post.body).replace(remap, '')[0:50]
    return render_template("index.html", title="Home", user=user, form=form, posts=posts)


# remove openid
@app.route('/register', methods=['GET', 'POST'])
def register():
    # make sure if user is logined
    # if g.user is not None:
    #     return redirect(('/index'))
    form = RegisterForm()
    if form.validate_on_submit():
        if form.password.data != form.confirm.data:
            flash('两次输入密码不一致，请重新输入！')
            return redirect(url_for('register'))
        u = models.User.query.filter_by(account=form.account.data).first()
        print(u)
        if u is not None:
            flash('用户名已经被占用！')
            return redirect(url_for('register'))
        if len(form.password.data) < 6:
            flash('密码太短!')
            return redirect(url_for('register'))
        session['remember_me'] = form.remember_me.data
        new_user = models.User(account=form.account.data, password=form.password.data)
        db.session.add(new_user)
        db.session.commit()
        flash('注册成功! Your account is"' + form.account.data + '",remember me =' + str(form.remember_me.data))
        g.user = new_user
        # 使自己成为自己的关注者
        db.session.add(g.user.follow(g.user))
        # 触发器，创建新用户的时候添加第一条博客
        p = models.Post(title='我的第一条博客', body='我的第一条博客！！', timestamp=datetime.utcnow(), user_id=g.user.id,
                        update=0)
        db.session.add(p)
        db.session.commit()
        login_user(new_user)
        return redirect('/index')
    return render_template("register.html", title='Sign in', form=form)


@app.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        u = models.User.query.filter_by(account=form.account.data, password=form.password.data).first()
        if u is None:
            flash('账号或密码不正确')
            return redirect(url_for('login'))
        session['remember_me'] = form.remember_me.data
        flash('登录成功')
        login_user(u)
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
    for post in posts.items:
        post.body = re.sub(r'</?\w+[^>]*>', '', post.body).replace(remap, '')[0:20]
    return render_template('user.html', user=user, posts=posts)


@app.route('/edit', methods=['GET', 'POST'])
@login_required
def edit():
    form = EditForm()
    if form.validate_on_submit():
        g.user.about_me = form.about_me.data
        g.user.job = form.job.data
        g.user.location = form.location.data
        db.session.add(g.user)
        db.session.commit()
        flash("Your changes have been saved.")
        return redirect(url_for('user', account=g.user.account))
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


@app.route('/collection', methods=['GET', 'POST'])
@login_required
def collection():
    user = g.user
    form = CollectionForm()
    if form.validate_on_submit():
        collection = Collection(title=form.title.data, description=form.description.data, owner=g.user)
        db.session.add(collection)
        db.session.commit()
        flash('Your Collection is now live!')
        return redirect(url_for('collection'))
    collections = g.user.own_collections()
    return render_template("collection.html", title="Collection", user=user, form=form, collections=collections)


@app.route('/favorite/<collection>', methods=['GET', 'POST'])
@app.route('/favorite/<collection>/<int:page>', methods=['GET', 'POST'])
@login_required
def favorite(collection, page=1):
    c = Collection.query.filter_by(id=int(collection)).first()
    posts = c.within_posts().paginate(page, POSTS_PER_PAGE, False)
    return render_template("favorite.html", title="Home", user=user, posts=posts)


@app.route('/star/<post>/<user>', methods=['GET', 'POST'])
@login_required
def star(post, user):
    collections = Collection.query.filter_by(user_id=g.user.id).all()
    if collections is None:
        flash("你的收藏为空！")
        return render_template()
    form = StarForm()
    form.star.choices = [(collection.id, collection.title) for collection in collections]
    # print(form.is_submitted())
    # print(form.validate())
    if form.validate_on_submit():
        print(form.star.data)
        c = Collection.query.filter_by(id=form.star.data).first()
        p = Post.query.filter_by(id=post).first()
        c.total += 1
        c.contents.append(p)
        db.session.add(c)
        db.session.commit()
        flash("收藏添加成功")
        render_template('star.html', title='star', user=user, collections=collections, post=post, form=form)
    return render_template('star.html', title='star', user=user, collections=collections, post=post, form=form)


@app.route('/new', methods=['GET', 'POST'])
@login_required
def new():
    user = g.user
    form = PostForm()
    print(form.is_submitted())
    print(form.validate())
    if form.validate_on_submit():
        # print(form.body.data)
        # print(form.body.data)
        # print(isinstance(form.body.data, unicode))
        # body=form.body.data.decode('utf-8')
        # print(body)
        p = models.Post(user_id=g.user.id, title=form.title.data, body=form.body.data)
        db.session.add(p)
        db.session.commit()
        flash("你的博文已保存！")
        return redirect(url_for('index'))
        # else:
        # form.about_me.data = g.user.about_me
    return render_template('new.html', title='new', user=user, form=form)


# def gen_rnd_filename():
#     filename_prefix = datetime.utcnow()
#     return '%s%s' % filename_prefix % str(random.randrange(1000,100000))


@app.route('/ckupload', methods=['POST'])
def ckupload():
    form = EditForm()
    response = form.upload(endpoint=app)
    return response


@app.route('/one/<id>')
def one(id):
    post = Post.query.filter_by(id=id).first()
    return render_template('one.html', post=post)


@app.route('/randombox')
# @app.route('/square/<int:page>')
def randombox():
    # posts = models.Post().all()
    posts = Post.query.all()
    for post in posts:
        post.body = re.sub(r'</?\w+[^>]*>', '', post.body).replace(remap, '')[0:50]
    # db.session.commit()
    slice = random.sample(posts, 5)
    return render_template('randombox.html', posts=slice)


# @app.route('/up/<reader>/<post>')
# def up(reader, post):/


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
