import RommeCal from './modules/chart';

import breakpoints from '../style/scss/_global.scss';

function getCurrentPlayers() {
  return $('.img-player.active')
    .map((index, element) => $(element).data('player'))
    .get();
}

$(document).ready(() => {
  let isSmall = $(window).width() <= breakpoints.small;

  // draw chart
  RommeCal.init('#chart-container', !isSmall);

  // enable/disable grid interactions on window resize
  $(window).resize(() => {
    isSmall = $(window).width() <= breakpoints.small;
    if (isSmall && RommeCal.grid.interactionsEnabled) {
      RommeCal.disableInteractions();
    } else if (!isSmall && !RommeCal.grid.interactionsEnabled) {
      RommeCal.enableInteractions();
    }
  });

  // update chart when player selection is updated
  $('.img-player').on('click', (event) => {
    $(event.currentTarget).toggleClass('active');

    const players = getCurrentPlayers();
    RommeCal.updatePlayers(players);
  });
});
