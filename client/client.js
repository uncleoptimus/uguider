// Client
// considering using local storage to check for visited links
// alternative is to create new data field on server, a list of Users who clicked a post
//function initStorage() {
//	window.storage = {
//		set: function(key, value) {
//			if (!key || !value) {return;}
//
//			if (typeof value === "object") {
//				value = JSON.stringify(value);
//			}
//			localStorage.setItem(key, value);
//		},
//		get: function(key) {
//			var value = localStorage.getItem(key);
//
//			if (!value) {return;}
//
//			value = JSON.parse(value);
//			return value;
//		}
//	}
//	localStorage.setItem('saved_list', test_data);
//}


// this autorun implements lazier loading behaviour
var LINKS_INCREMENT = 10;
Session.setDefault('links_limit', LINKS_INCREMENT);
Deps.autorun(function () {
	Meteor.subscribe('links', Session.get('links_limit'));
});

// whenever no user logged in clear name from display
Deps.autorun(function () {
	if(!Meteor.userId())
	{
		// elem may not exist yet...created on login attempt
		// if null, then great. nothing needs to be done
		var login_name_elem = document.querySelector('.login-name');
		if (login_name_elem) {
			document.querySelector('.login-name').textContent = '';
		}
	}
})

var getUsername = function () {
	var profile = Meteor.user().profile;
	return profile.firstName + ' ' + profile.lastName;
}

var fetchMorePosts = function () {
	var threshold,
			target = document.getElementById('morePostsAvailable');

	// if not hidden there are more posts to fetch
	if (target) {
		threshold = window.pageYOffset + window.innerHeight - target.scrollHeight;

		// from You May Not Need jQuery
		var target_offset = target.getBoundingClientRect().top + document.body.scrollTop;

		if (target_offset < threshold) {
			if (!target.getAttribute('data-visible')) {
				target.setAttribute('data-visible', true);
				// moved to click handler
				// Session.set('links_limit', Session.get('links_limit') + LINKS_INCREMENT);
			} else {
				if (target.getAttribute('data-visible')) {
					target.setAttribute('data-visible', false);
				}
			}
		}
	}
}
window.addEventListener('scroll', fetchMorePosts); // debounce for perf?

// login customization
// this code chunk just displays user's name after login
// Making it work with accounts-ui template which seems to use innerHtml func
// to raze n replace content each time. thus I need to recreate this node each time?
Accounts.onLogin(function () {

			console.log(getUsername());

	var login_name_elem = document.querySelector('.login-name');
	if(!login_name_elem) {
		// not created yet. create now
		var element = document.createElement('span');
		element.className = 'login-name';
		element.textContent = 'Hello, ' + Meteor.user().profile.firstName;

		var parent = document.querySelector('#login-buttons');
		parent.insertBefore(element, parent.firstChild);
	}
	else {
		login_name_elem.text = 'Well Hello';
	}

});

Template.post_form.events({
	'submit form': function (event) {
		event.preventDefault();

		var form = event.target;
		Meteor.call('insertPost', form.title.value, form.url.value, form.source.value, Meteor.user().profile.firstName);

		// reset form fields
		form.url.value = '';
		form.title.value = '';
	}
});

Template.post_list.helpers({
	// feed post-list with posts avail to display
	// prob: ranking doesn't trigger refresh in list display
	// qed: oops, forgot to sort on this end...obvious fix obvious result
	post: function () {
		return Links.find({}, { sort: {hp: -1, date_added: -1} });
	},
	oneClickLabel: function () {
		return this.clicks === 1;
	},
	// control visibility of 'load links' btn
	moreLinks: function () {
		// compared against stored session data which will always be >=
		// since fetched postson client side can't exceed links_limit
		return !(Links.find().count() < Session.get("links_limit"));
	},
	// determines source icon in post
	sourceIcon: function () {
		return this.source.toLowerCase();
	},
	// takes raw data in ms and formats to human readable date
	getDate: function () {
		return moment(this.date_added).format('MMMM Do YYYY, h:mm:ss a');
	},
	// checks if user already clicked on this link
	clickedByUser: function () {
//		return this.clickers && this.clickers.indexOf(getUsername());
		return this.clickers && (this.clickers.indexOf(getUsername()) !== -1);
	}
});

Template.post_list.events({
	'click .post a': function () {
		// update list of clickers here or on server?
		Meteor.call('updateClicks', this._id, getUsername());
	},
	// load more results on click; uses spin.js on 1.5s delay
	'click #morePostsAvailable': function () {
		var spinner = new Spinner().spin();
		var target = document.getElementById('morePostsAvailable');
		target.querySelector('span').style.opacity = 0;
		target.appendChild(spinner.el);
		setTimeout(function () {
			// updating this value triggers autorun; display 'reactively' fetches more posts
			Session.set('links_limit', Session.get('links_limit') + LINKS_INCREMENT);
			spinner.stop();
		}, 1500);
	}
});

Template.lifebar.helpers({
	// one helper to style each 'life unit'
	firstHeart: function () {
		return this.hp > 0;
	},
	secondHeart: function () {
		return this.hp > 1;
	},
	thirdHeart: function () {
		return this.hp > 2;
	},
	// the helpers below determine if the rank btns display to user
	// disables if score too high/too low or post's prev ranker is current user
	upButtonDisable: function () {
		if (this.hp > 2 | Meteor.user().profile.firstName === this.lastUpdatedBy) return "disabled";
	},
	downButtonDisable: function () {
		if (this.hp < 1 | Meteor.user().profile.firstName === this.lastUpdatedBy) return "disabled";
	}

});

Template.lifebar.events({
	'click .post__lifebar__control': function (event) {
		// update target post's HP value in minimongo
		var control = event.currentTarget.dataset.control,
				current_user = Meteor.user().profile.firstName;
			if(control === 'up') {
				Meteor.call('updateRank', this._id, 1, current_user);
			}
// else check if hearts at 0; CURRENTLY REMOVED BEHAVIOR
//			else if (this.hp - 1 === 0) {
//				Links.remove(this._id);
//			}
			else {
				Meteor.call('updateRank', this._id, -1, current_user);
			}
	}
});

Template.about_modal.events({
	'click button': function (event) {
		Session.set('about_visible', false);
	}
});

Session.setDefault('about_visible', false);
Session.setDefault('postform_visible', true);

Template.body.events({
	'click .header__about': function () {
		var about_modal = document.querySelector('.about__container');
		if (Session.get('about_visible')) {
//			about_modal.style.display = 'none';
			Session.set('about_visible', false);
		}	else {
//			about_modal.style.display = 'inherit';
			Session.set('about_visible', true);
		}
	},

	'click .header__postform': function () {
		if (Session.get('postform_visible')) {
			Session.set('postform_visible', false);
		}	else {
			Session.set('postform_visible', true);
		}
	}
});

Template.body.helpers({
	showAbout: function () {
		return Session.get('about_visible');
	},
	showPostform: function () {
		return Session.get('postform_visible');
	},
	serverUpdateTime: function () {
		return Session.get('server_time');
	}
});

Meteor.startup(function () {
	Meteor.call('getUpdateTime', function (error, result) {
		if (!error)
			Session.set('server_time', result);
	});
	Meteor.setInterval(function () {
//	currently runs every twelve hrs
		Meteor.call('getUpdateTime', function (error, result) {
			if (!error)
				Session.set('server_time', result);
		});
	}, 12 * 360 * 1000);

});
