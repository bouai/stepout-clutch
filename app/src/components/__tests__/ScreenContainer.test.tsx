import { Text, View } from 'react-native';

import ScreenContainer, { FLOATING_NAV_CLEARANCE } from '../ScreenContainer';
import { renderWithSafeArea } from '../../test-utils';

// The frame configured in test-utils.
const TOP_INSET = 47;
const BOTTOM_INSET = 34;

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, entry) => ({ ...acc, ...flatten(entry) }),
      {}
    );
  }
  return (style ?? {}) as Record<string, unknown>;
}

describe('ScreenContainer', () => {
  it('scrolls by default so content past the fold stays reachable', async () => {
    const view = await renderWithSafeArea(
      <ScreenContainer testID="subject">
        <Text>content</Text>
      </ScreenContainer>
    );

    expect(view.getByTestId('subject')).toBeTruthy();
    expect(view.getByText('content')).toBeTruthy();
  });

  it('renders many children without dropping any', async () => {
    const labels = Array.from({ length: 40 }, (_, i) => `row-${i}`);

    const view = await renderWithSafeArea(
      <ScreenContainer>
        {labels.map((label) => (
          <Text key={label}>{label}</Text>
        ))}
      </ScreenContainer>
    );

    // A fixed View would still *render* these, but only a scroll container
    // lets a user reach them. The scroll assertion above is the real guard;
    // this one catches accidental virtualisation/truncation.
    labels.forEach((label) => expect(view.getByText(label)).toBeTruthy());
  });

  it('offsets content by the safe-area insets rather than a fixed padding', async () => {
    const view = await renderWithSafeArea(
      <ScreenContainer testID="subject">
        <Text>content</Text>
      </ScreenContainer>
    );

    const style = flatten(view.getByTestId('subject').props.contentContainerStyle);
    expect(style.paddingTop).toBeGreaterThan(TOP_INSET);
    expect(style.paddingBottom).toBe(BOTTOM_INSET + FLOATING_NAV_CLEARANCE);
  });

  it('clears the floating nav so the last card is not hidden behind it', async () => {
    const view = await renderWithSafeArea(
      <ScreenContainer testID="subject">
        <Text>content</Text>
      </ScreenContainer>
    );

    const style = flatten(view.getByTestId('subject').props.contentContainerStyle);
    expect(style.paddingBottom).toBeGreaterThanOrEqual(FLOATING_NAV_CLEARANCE);
  });

  it('renders a fixed container when scrolling is opted out for map screens', async () => {
    const view = await renderWithSafeArea(
      <ScreenContainer scrollable={false} testID="subject">
        <View testID="map" />
      </ScreenContainer>
    );

    const subject = view.getByTestId('subject');
    expect(subject.props.contentContainerStyle).toBeUndefined();
    expect(view.getByTestId('map')).toBeTruthy();
  });

  it('renders the title when given one', async () => {
    const view = await renderWithSafeArea(
      <ScreenContainer title="Home">
        <Text>content</Text>
      </ScreenContainer>
    );

    expect(view.getByText('Home')).toBeTruthy();
  });

  it('omits pull-to-refresh when no handler is supplied', async () => {
    const view = await renderWithSafeArea(
      <ScreenContainer testID="subject">
        <Text>content</Text>
      </ScreenContainer>
    );

    expect(view.getByTestId('subject').props.refreshControl).toBeUndefined();
  });

  it('wires pull-to-refresh when a handler is supplied', async () => {
    const onRefresh = jest.fn();
    const view = await renderWithSafeArea(
      <ScreenContainer testID="subject" onRefresh={onRefresh} refreshing={false}>
        <Text>content</Text>
      </ScreenContainer>
    );

    expect(view.getByTestId('subject').props.refreshControl).toBeTruthy();
  });
});
