// Home-hero seasonal awareness. The Easter cycle moves every year, so it is
// computed (Anonymous Gregorian algorithm) instead of hard-coded; Advent is the
// fourth Sunday before Christmas. All boundaries are local calendar days so the
// greeting and the season agree with the listener's clock.

const atMidnight = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return atMidnight(copy);
};

/** Easter Sunday for a Gregorian year. */
export const easterSunday = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

/** First Sunday of Advent: the fourth Sunday before Christmas. */
export const adventStart = (year) => {
  const christmas = new Date(year, 11, 25);
  const weekday = christmas.getDay(); // Sunday = 0
  const daysBack = (weekday === 0 ? 7 : weekday) + 21;
  return addDays(christmas, -daysBack);
};

export const WORSHIP_SEASONS = Object.freeze({
  advent: Object.freeze({
    key: "advent",
    label: "Advent",
    title: "A quiet Advent",
    description: "Songs for waiting, hoping, and making room.",
    verse: Object.freeze({
      ref: "Isaiah 9:6",
      text: "For to us a child is born, to us a son is given; and the government shall be upon his shoulder.",
    }),
  }),
  christmas: Object.freeze({
    key: "christmas",
    label: "Christmas",
    title: "Christmas worship",
    description: "Celebrate the birth of Christ with the songs of the season.",
    verse: Object.freeze({
      ref: "Luke 2:14",
      text: "Glory to God in the highest, and on earth peace among those with whom he is pleased!",
    }),
  }),
  lent: Object.freeze({
    key: "lent",
    label: "Lent",
    title: "Songs for the wilderness",
    description: "A quieter soundtrack for reflection and repentance.",
    verse: Object.freeze({
      ref: "Joel 2:13",
      text: "Return to the Lord your God, for he is gracious and merciful, slow to anger, and abounding in steadfast love.",
    }),
  }),
  easter: Object.freeze({
    key: "easter",
    label: "Easter",
    title: "He is risen",
    description: "Celebrate the resurrection with songs of victory and hope.",
    verse: Object.freeze({
      ref: "Matthew 28:6",
      text: "He is not here, for he has risen, as he said.",
    }),
  }),
  ordinary: Object.freeze({
    key: "ordinary",
    label: "",
    title: "Worship Sessions",
    description: "Praise and worship to sing along with, any time of day.",
    verse: null,
  }),
});

/**
 * Which worship season contains `date`. Christmas deliberately spans the new
 * year, so early January uses the previous year's Christmas rather than falling
 * through to Ordinary Time.
 */
export const getWorshipSeason = (date = new Date()) => {
  const today = atMidnight(date);
  const year = today.getFullYear();

  const christmas = new Date(year, 11, 25);
  const epiphany = new Date(year, 0, 6);
  const previousChristmas = new Date(year - 1, 11, 25);
  if (today >= previousChristmas && today <= epiphany) return WORSHIP_SEASONS.christmas;
  if (today >= christmas) return WORSHIP_SEASONS.christmas;

  const advent = adventStart(year);
  if (today >= advent) return WORSHIP_SEASONS.advent;

  const easter = easterSunday(year);
  const ashWednesday = addDays(easter, -46);
  const holySaturday = addDays(easter, -1);
  const pentecost = addDays(easter, 49);
  if (today >= ashWednesday && today <= holySaturday) return WORSHIP_SEASONS.lent;
  if (today >= easter && today <= pentecost) return WORSHIP_SEASONS.easter;

  return WORSHIP_SEASONS.ordinary;
};
