// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment, {Moment} from 'moment-timezone';
import React from 'react';
import {injectIntl, IntlShape} from 'react-intl';
import {DeviceEventEmitter, Dimensions, Keyboard, KeyboardAvoidingView, Platform, ScrollView, View} from 'react-native';
import {EventSubscription, Navigation, NavigationButtonPressedEvent, NavigationComponent, NavigationComponentProps, Options, OptionsTopBarButton} from 'react-native-navigation';
import {SafeAreaView} from 'react-native-safe-area-context';

import {unsetCustomStatus} from '@actions/remote/user';
import CompassIcon from '@components/compass_icon';
import StatusBar from '@components/status_bar';
import {CustomStatusDuration, Device} from '@constants';
import {SET_CUSTOM_STATUS_FAILURE} from '@constants/custom_status';
import {withServerUrl} from '@context/server_url';
import {withTheme} from '@context/theme';
import ClearAfter from '@screens/custom_status/components/clear_after';
import CustomStatusSuggestions from '@screens/custom_status/components/custom_status_suggestions';
import RecentCustomStatuses from '@screens/custom_status/components/recent_custom_statuses';
import {dismissModal, goToScreen, mergeNavigationOptions, showModal} from '@screens/navigation';
import {getCurrentMomentForTimezone} from '@utils/helpers';
import {preventDoubleTap} from '@utils/tap';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

import {getRoundedTime} from '../custom_status_clear_after/date_time_selector';

import CustomStatusInput from './components/custom_status_input';

interface Props extends NavigationComponentProps {
    intl: IntlShape;
    theme: Theme;
    customStatus: UserCustomStatus;
    userTimezone: string;
    serverUrl: string;
    recentCustomStatuses: UserCustomStatus[];

    // actions: {
    //     setCustomStatus: (customStatus: UserCustomStatus) => Promise<ActionResult>;
    //     unsetCustomStatus: () => ActionFunc;
    //     removeRecentCustomStatus: (customStatus: UserCustomStatus) => ActionFunc;
    // };
    isExpirySupported: boolean;
    isCustomStatusExpired: boolean;
}

type CustomStatusDurationType = keyof typeof CustomStatusDuration

type State = {
    emoji?: string;
    text?: string;
    duration: CustomStatusDurationType;
    expires_at: Moment;
    isLandScape: boolean;
}

const {DONT_CLEAR, THIRTY_MINUTES, ONE_HOUR, FOUR_HOURS, TODAY, THIS_WEEK, DATE_AND_TIME} = CustomStatusDuration;
const defaultDuration: CustomStatusDurationType = 'TODAY';

const BTN_UPDATE_STATUS = 'update-custom-status';

class CustomStatusModal extends NavigationComponent<Props, State> {
    rightButton: OptionsTopBarButton = {
        id: BTN_UPDATE_STATUS,
        testID: 'custom_status.done.button',
        enabled: true,
        showAsAction: 'always',
    };
    private navigationEventListener: EventSubscription | undefined;

    static options(): Options {
        return {
            topBar: {
                title: {
                    alignment: 'center',
                },
            },
        };
    }

    constructor(props: Props) {
        super(props);
        const {customStatus, userTimezone, isCustomStatusExpired, intl, theme, componentId} = props;

        this.rightButton.text = intl.formatMessage({id: 'mobile.custom_status.modal_confirm', defaultMessage: 'Done'});
        this.rightButton.color = theme.sidebarHeaderTextColor;

        const options: Options = {
            topBar: {
                rightButtons: [this.rightButton],
            },
        };
        mergeNavigationOptions(componentId, options);

        const currentTime = getCurrentMomentForTimezone(userTimezone);

        let initialCustomExpiryTime: Moment = getRoundedTime(currentTime);
        const isCurrentCustomStatusSet = !isCustomStatusExpired && (customStatus?.text || customStatus?.emoji);
        if (isCurrentCustomStatusSet && customStatus?.duration === DATE_AND_TIME && customStatus?.expires_at) {
            initialCustomExpiryTime = moment(customStatus?.expires_at);
        }

        this.state = {
            emoji: isCurrentCustomStatusSet ? customStatus?.emoji : '',
            text: isCurrentCustomStatusSet ? customStatus?.text : '',
            duration: isCurrentCustomStatusSet ? (customStatus?.duration ?? DONT_CLEAR) : defaultDuration,
            expires_at: initialCustomExpiryTime,
            isLandScape: false,
        };
    }

    componentDidMount() {
        this.navigationEventListener = Navigation.events().bindComponent(this);
    }
    componentWillUnmount() {
        // Not mandatory
        if (this.navigationEventListener) {
            this.navigationEventListener.remove();
        }
    }

    componentDidAppear() {
        console.log('>>>  CustomStatusModal appeared');
        const {width, height} = Dimensions.get('screen');
        this.setState({
            isLandScape: width > height,
        });
    }

    navigationButtonPressed({buttonId}: NavigationButtonPressedEvent) {
        switch (buttonId) {
            case BTN_UPDATE_STATUS:
                this.handleSetStatus();
                break;
        }
    }

    handleSetStatus = async () => {
        const {emoji, text, duration} = this.state;
        const isStatusSet = emoji || text;
        const {customStatus, isExpirySupported, serverUrl} = this.props;
        if (isStatusSet) {
            let isStatusSame = customStatus?.emoji === emoji && customStatus?.text === text && customStatus?.duration === duration;
            if (isStatusSame && duration === DATE_AND_TIME) {
                isStatusSame = customStatus?.expires_at === this.calculateExpiryTime(duration);
            }
            if (!isStatusSame) {
                const status: UserCustomStatus = {
                    emoji: emoji || 'speech_balloon',
                    text: text?.trim(),
                    duration: DONT_CLEAR,
                };

                if (isExpirySupported) {
                    status.duration = duration;
                    status.expires_at = this.calculateExpiryTime(duration);
                }

                //todo: api call setCustomStatus
                const {error} = await setCustomStatus(status);
                if (error) {
                    DeviceEventEmitter.emit(SET_CUSTOM_STATUS_FAILURE);
                }
            }
        } else if (customStatus?.emoji) {
            unsetCustomStatus(serverUrl);
        }
        Keyboard.dismiss();
        dismissModal();
    };

    calculateExpiryTime = (duration: CustomStatusDurationType): string => {
        const {userTimezone} = this.props;
        const currentTime = getCurrentMomentForTimezone(userTimezone);
        const {expires_at} = this.state;
        switch (duration) {
            case THIRTY_MINUTES:
                return currentTime.add(30, 'minutes').seconds(0).milliseconds(0).toISOString();
            case ONE_HOUR:
                return currentTime.add(1, 'hour').seconds(0).milliseconds(0).toISOString();
            case FOUR_HOURS:
                return currentTime.add(4, 'hours').seconds(0).milliseconds(0).toISOString();
            case TODAY:
                return currentTime.endOf('day').toISOString();
            case THIS_WEEK:
                return currentTime.endOf('week').toISOString();
            case DATE_AND_TIME:
                return expires_at.toISOString();
            case DONT_CLEAR:
            default:
                return '';
        }
    };

    handleTextChange = (value: string) => this.setState({text: value});

    //todo: this.props.actions.removeRecentCustomStatus
    handleRecentCustomStatusClear = (status: UserCustomStatus) => removeRecentCustomStatus(status);

    clearHandle = () => {
        this.setState({emoji: '', text: '', duration: defaultDuration});
    };

    handleCustomStatusSuggestionClick = (status: UserCustomStatus) => {
        const {emoji, text, duration} = status;
        this.setState({emoji, text, duration});
    };

    handleRecentCustomStatusSuggestionClick = (status: UserCustomStatus) => {
        const {emoji, text, duration} = status;
        this.setState({emoji, text, duration: duration || DONT_CLEAR});
        if (duration === DATE_AND_TIME) {
            this.openClearAfterModal();
        }
    };

    openEmojiPicker = preventDoubleTap(() => {
        const {theme, intl} = this.props;
        CompassIcon.getImageSource('close', 24, theme.sidebarHeaderTextColor).then((source) => {
            const screen = 'AddReaction';
            const title = intl.formatMessage({id: 'mobile.custom_status.choose_emoji', defaultMessage: 'Choose an emoji'});
            const passProps = {
                closeButton: source,
                onEmojiPress: this.handleEmojiClick,
            };

            showModal(screen, title, passProps);
        });
    });

    handleEmojiClick = (emoji: string) => {
        dismissModal();
        this.setState({emoji});
    }

    handleClearAfterClick = (duration: CustomStatusDurationType, expires_at: string) => this.setState({
        duration,
        expires_at: duration === DATE_AND_TIME && expires_at ? moment(expires_at) : this.state.expires_at,
    });

    openClearAfterModal = async () => {
        const {intl, theme} = this.props;
        const screen = 'ClearAfter';
        const title = intl.formatMessage({id: 'mobile.custom_status.clear_after', defaultMessage: 'Clear After'});
        const passProps = {
            handleClearAfterClick: this.handleClearAfterClick,
            initialDuration: this.state.duration,
            intl,
            theme,
        };

        goToScreen(screen, title, passProps);
    };

    render() {
        const {duration, emoji, expires_at, isLandScape, text} = this.state;
        const {currentUser, intl, isExpirySupported, recentCustomStatuses, theme} = this.props;

        let keyboardOffset = Device.IS_IPHONE_WITH_INSETS ? 110 : 60;
        if (isLandScape) {
            keyboardOffset = Device.IS_IPHONE_WITH_INSETS ? 0 : 10;
        }

        const isStatusSet = Boolean(emoji || text);

        const style = getStyleSheet(theme);

        return (
            <SafeAreaView
                style={style.container}
                testID='custom_status.screen'
            >
                <KeyboardAvoidingView
                    behavior='padding'
                    enabled={Platform.OS === 'ios'}
                    keyboardVerticalOffset={keyboardOffset}
                    style={style.container}
                >
                    <ScrollView
                        bounces={false}
                    >
                        <StatusBar theme={theme}/>
                        <View style={style.scrollView}>
                            <View style={style.block}>
                                <CustomStatusInput
                                    emoji={emoji}
                                    intl={intl}
                                    isStatusSet={isStatusSet}
                                    onChangeText={this.handleTextChange}
                                    onClearHandle={this.clearHandle}
                                    onOpenEmojiPicker={this.openEmojiPicker}
                                    text={text}
                                    theme={theme}
                                />
                                {isStatusSet && isExpirySupported && (
                                    <ClearAfter
                                        currentUser={currentUser}
                                        duration={duration}
                                        expiresAt={expires_at}
                                        intl={intl}
                                        onOpenClearAfterModal={this.openClearAfterModal}
                                        theme={theme}
                                    />)}
                            </View>
                            {recentCustomStatuses.length > 0 && (
                                <RecentCustomStatuses
                                    isExpirySupported={isExpirySupported}
                                    onHandleClear={this.handleRecentCustomStatusClear}
                                    onHandleSuggestionClick={this.handleRecentCustomStatusSuggestionClick}
                                    recentCustomStatuses={recentCustomStatuses}
                                    theme={theme}
                                />
                            )}
                            <CustomStatusSuggestions
                                intl={intl}
                                isExpirySupported={isExpirySupported}
                                onHandleCustomStatusSuggestionClick={this.handleCustomStatusSuggestionClick}
                                recentCustomStatuses={recentCustomStatuses}
                                theme={theme}
                            />
                        </View>
                        <View style={style.separator}/>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }
}

export default injectIntl(withTheme(withServerUrl(CustomStatusModal)));

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        container: {
            flex: 1,
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.03),
        },
        scrollView: {
            flex: 1,
            paddingTop: 32,
        },
        separator: {
            marginTop: 32,
        },
        block: {
            borderBottomColor: changeOpacity(theme.centerChannelColor, 0.1),
            borderBottomWidth: 1,
            borderTopColor: changeOpacity(theme.centerChannelColor, 0.1),
            borderTopWidth: 1,
        },
    };
});
