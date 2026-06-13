import { Dimensions } from 'react-native';

/** Horizontal padding for tab screens and bottom sheets (aligns hero, sections, and forms). */
export const SCREEN_GUTTER = 16;

/** Peek of the next card visible at the right edge in home horizontal carousels. */
export const HOME_CAROUSEL_CARD_PEEK = 48;

/** Shared card width for home horizontal sections (doctors, health videos). */
export const HOME_CAROUSEL_CARD_WIDTH = Math.max(
  260,
  Dimensions.get('window').width - SCREEN_GUTTER * 2 - HOME_CAROUSEL_CARD_PEEK
);

/** Extra scroll padding above the tab bar + FAB. */
export const TAB_SCROLL_BOTTOM_PADDING = 108;

/** Vertical space between major home sections. */
export const SECTION_GAP = 24;

/** Default corner radius for cards, selectors, and tab buttons. */
export const SURFACE_RADIUS = 12;
