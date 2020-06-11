import RommeCal from './assets/modules/chart.js';

$(document).ready(function() {
  "use strict";

  // draw chart
  RommeCal.init('#chart-container');

  // update chart when player selection is updated
  $('.img-player').on('click', function() {
    $(this).toggleClass('active');

    const players = getCurrentPlayers();
    RommeCal.updatePlayers(players);
  });
});

function getCurrentPlayers() {
  return $('.img-player.active')
    .map(function() {
      return $(this).data('player');
    })
    .get();
}
