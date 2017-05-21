// Module includes.
require('dotenv').config();
var schedule = require('node-schedule');
var moment = require('moment');
var {Wit, log} = require('node-wit');
var RtmClient = require('@slack/client').RtmClient;
var WebClient = require('@slack/client').WebClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;

var scheduler = require('./libs/scheduler.js');
var messageHandler = require('./libs/messageHandler.js');

// Service connections.
var web = new WebClient(process.env.SLACK_API_TOKEN);
var rtm = new RtmClient(process.env.SLACK_BOT_TOKEN);
var wit = new Wit({accessToken: process.env.WIT_ACCESS_TOKEN});

rtm.start();

// React to messages.
rtm.on(RTM_EVENTS.MESSAGE, function(message) {
  // We only care about regular messages that mention us.
  if (!('subtype' in message) && (message.text.indexOf('<@U5G5UJ0QN>') != -1)) {
    rtm.sendTyping(message.channel);

    if (message.text.toLowerCase().indexOf('help') == -1) {
      wit.message(message.text, {})
      .then((data) => {
        if ('intent' in data.entities) {
          rtm.sendMessage(messageHandler(data), message.channel);
        }
        else {
          // Send "I don't understand that" message.
          rtm.sendMessage('Sorry, I don\'t understand what you said. Go ask John what you did wrong.', message.channel);
        }
      });
    }
    else {
      // Send help message.
      rtm.sendMessage('Go ask John for help, I\'m busy!', message.channel);
    }
  }
});

// Post reminder on schedule.
/*var rule = new schedule.RecurrenceRule();
rule.dayOfWeek = 4;
rule.hour = 18;
rule.minute = 30;

schedule.scheduleJob(rule, function() {
  postReminder();
});

// Update users next date.
rule.dayOfWeek = 1;
schedule.scheduleJob(rule, function() {
  updateNext();
})*/

/**
 * Send reminder message to #dinners.
 */
function postReminder() {
  var next = scheduler.getNext();
  var follower = scheduler.getFollower(next.next);

  var message = `${next.users[0]} and ${next.users[1]}, you two are on dinners next week!\n` +
                `${follower.users[0]} and ${follower.users[1]}, you guys are doing the discussion!`;

  rtm.sendMessage(message, 'C3Q22SRHC');
}

/**
 * Update the dates users will be on.
 */
function updateNext() {
  var today = moment(moment().format('YYYY-MM-DD')).unix()
  var dinnerSchedule = scheduler.getSchedule();

  for (var i=0; i < dinnerSchedule.length; i++) {
    if (dinnerSchedule[i].next <= today) {
      // Advance the users next date by a number of weeks equal to the number of pairs.
      var next = moment(today).add(dinnerSchedule.length, 'w');
      scheduler.updateNext(dinnerSchedule[i].users[0], next.unix());
    }
  }
}
