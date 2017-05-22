/**
 * Handles messages from Wit and builds responses.
 */

var moment = require('moment');
var scheduler = require('./scheduler.js');
var WebClient = require('@slack/client').WebClient;

var slackWeb = new WebClient(process.env.SLACK_API_TOKEN);
var botID = 'U5G5UJ0QN';

/**
 * Starting point of message interpretation.
 * Will figure out how to handle message.
 *
 * @param  {object} data
 *         JSON object from wit.ai.
 *
 * @return {Promise}
 *         A Promise object containing a message generated by helper functions.
 */
function handleMessage(data) {
   switch (data.entities.intent[0].value) {
    case 'get':
      return handleGet(data);

    case 'skip':
      return handleSkip(data);

    case 'swap':
      return handleSwap(data);

    default:
      return Promise.reject(`Unhandled intent: ${JSON.stringify(data)}`);
   }
}

/*******************************
 **     HELPER FUNCTIONS      **
 *******************************/

/**
 * Handle a "get" intent.
 * User could be trying to get the next dinner, a date for a user
 * or users for a date.
 *
 * @param  {object} data
 *         JSON object from wit.ai.
 *
 * @return {Promise}
 *         A Promise object containing a message to send back to Slack.
 */
function handleGet(data) {
  if ('datetime' in data.entities) {
    // Grab the Monday of the week the date is in.
    var date = moment(data.entities.datetime[0].value).day(1);
    var users = scheduler.getUsers(date.unix());

    if (Array.isArray(users)) {
      return Promise.resolve(`${users[0]} and ${users[1]} are on ${date.format('MMM Do')}.`);
    }
    else {
      return Promise.resolve(`Looks like no one is scheduled to be on ${date.format('MMM Do')}!`);
    }
  }
  else if (('contact' in data.entities) && (data.entities.contact.length > 1)) {
    // Grab the first name that isn't our bot.
    for (var i=0; i < data.entities.contact.length; i++) {
      if (data.entities.contact[i].value.indexOf(botID) == -1) {
        var name = data.entities.contact[i].value;
        break;
      }
    }

    // Get the userID to use in the lookup.
    return getUserID(name, data.slack.user)
      .then(function(user) {
        var date = scheduler.getDate(user);

        if (date != null) {
          return Promise.resolve(`${user} is doing dinner next on ${moment(date, 'X').format('MMM Do')}`);
        }
        else {
          return Promise.resolve(`Looks like ${user} isn't on the dinner schedule.`);
        }
      }, function(err) {
        Promise.reject(err);
      }
    );
  }
  else {
    var next = scheduler.getNext();
    if (next != null) {
      return Promise.resolve(`${next.users[0]} and ${next.users[1]} are on next.`);
    }
    else {
      return Promise.resolve('Looks like no one is scheduled for the next four weeks!');
    }
  }
}

/**
 * Handle a "skip" intent.
 *
 * @param  {object} data
 *         JSON object from wit.ai.
 *
 * @return {Promise}
 *         A resolved Promise object containing a confirmation message.
 */
function handleSkip(data) {
  // Default to skipping next Monday.
  var date = moment(moment().format('YYYY-MM-DD')).day(1);
  if (moment().isAfter(date)) {
    date.day(8);
  }

  if ('datetime' in data.entities) {
    date = moment(data.entities.datetime[0].value).day(1);
  }

  scheduler.postpone(date.unix());

  return Promise.resolve(`I've updated the schedule so there's no dinner on ${date.format('MMM Do')}.`);
}

/**
 * Handle a "swap" intent.
 *
 * @param  {object} data
 *         JSON object from wit.ai.
 *
 * @return {Promise}
 *         A resolved Promise object containing a confirmation message.
 */
function handleSwap(data) {
  return Promise.resolve('Whoa, swapping functionality isn\'t done yet!');
}

/**
 * Get the userID to use in the scheduler
 *
 * @param  {string} enteredName
 *         The name entered.
 *
 * @param  {object} sender
 *         The slack user who sent the message.
 *
 * @return {Promise}
 *         A Promise containing a userID to use in lookups.
 */
function getUserID(name, sender) {
  // Check if the name is refering to the person who sent the message.
  return new Promise(function(resolve, reject) {
    if ((name.toLowerCase() == 'i') || (name.toLowerCase() == 'my')) {
      console.log('its a possesive');
      resolve('<@' + sender + '>');
    }
    else if (name.slice(0, 2) == '<@') {
      console.log('its a slack userID');
      // Just return slack usernames (wit.ai sometimes drops the ending '>').
      if (name.slice(-1) != '>') {
        name += '>';
      }
      resolve(name);
    }
    else {
      console.log('its a real name');
      // Look for the name in the list of slack users.
      slackWeb.users.list(function(err, data) {
        if (!err) {
          var userID = null;

          for (var i=0; i < data.members.length; i++) {
            var member = data.members[i].real_name.split(' ');

            for (var j=0; j < member.length; j++) {
              if (member[j].toLowerCase() == name.toLowerCase()) {
                userID = '<@' + data.members[i].id + '>';
              }
            }
            // Leave loop if we found a userID.
            if (userID != null) { break; }
          }

          // If everything's failed, just use the name.
          if (userID == null) {
            userID = name.charAt(0).toUpperCase() + name.toLowerCase().slice(1);
          }

          resolve(userID);
        }
        else {
          reject(err);
        }
      });
    }
  });
}

module.exports = handleMessage;
