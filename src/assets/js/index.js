import RommeCal from './modules/chart';

import breakpoints from '../style/scss/_global.scss';

function getCurrentPlayers() {
  return $('.img-player.active')
    .map((index, element) => $(element).data('player'))
    .get();
}

$(document).ready(() => {
  let isExtraSmall = $(window).width() <= breakpoints.extraSmall;

  // draw chart
  RommeCal.init('#chart-container', !isExtraSmall);

  // enable/disable grid interactions on window resize
  $(window).resize(() => {
    isExtraSmall = $(window).width() <= breakpoints.extraSmall;
    if (isExtraSmall && RommeCal.grid.interactionsEnabled) {
      RommeCal.disableInteractions();
    } else if (!isExtraSmall && !RommeCal.grid.interactionsEnabled) {
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
