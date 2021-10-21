// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useWindowDimensions, View} from 'react-native';
import {OptionsModalPresentationStyle} from 'react-native-navigation';

import CompassIcon from '@components/compass_icon';
import TouchableWithFeedback from '@components/touchable_with_feedback';
import {Device, Screens} from '@constants';
import {useTheme} from '@context/theme';
import {useSplitView} from '@hooks/device';
import {showModal, showModalOverCurrentContext} from '@screens/navigation';
import {preventDoubleTap} from '@utils/tap';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

import AddTeamSlideUp from './add_team_slide_up';

import type TeamModel from '@typings/database/models/servers/team';

const ITEM_HEIGHT = 72;
const CREATE_HEIGHT = 97;
const HEADER_HEIGHT = 66;
const CONTAINER_HEIGHT = 392;

type Props = {
    canCreateTeams: boolean;
    otherTeams: TeamModel[];
}
export default function AddTeam({canCreateTeams, otherTeams}: Props) {
    const theme = useTheme();
    const styles = getStyleSheet(theme);
    const dimensions = useWindowDimensions();
    const intl = useIntl();
    const isSplitView = useSplitView();
    const isTablet = Device.IS_TABLET && !isSplitView;
    const maxHeight = Math.round((dimensions.height * 0.9));

    const onPress = useCallback(preventDoubleTap(() => {
        const renderContent = () => {
            return (
                <AddTeamSlideUp
                    otherTeams={otherTeams}
                    canCreateTeams={canCreateTeams}
                    showTitle={!isTablet && Boolean(otherTeams.length)}
                />
            );
        };

        let height = CONTAINER_HEIGHT;
        if (otherTeams.length) {
            height = Math.min(maxHeight, HEADER_HEIGHT + (otherTeams.length * ITEM_HEIGHT) + (canCreateTeams ? CREATE_HEIGHT : 0));
        }

        if (isTablet) {
            const closeButton = CompassIcon.getImageSourceSync('close', 24, theme.centerChannelColor);
            const closeButtonId = 'close-join-team';
            showModal(Screens.BOTTOM_SHEET, intl.formatMessage({id: 'mobile.add_team.join_team', defaultMessage: 'Join Another Team'}), {
                closeButtonId,
                renderContent,
                snapPoints: [height, 10],
            }, {
                modalPresentationStyle: OptionsModalPresentationStyle.formSheet,
                swipeToDismiss: true,
                topBar: {
                    leftButtons: [{
                        id: closeButtonId,
                        icon: closeButton,
                        testID: closeButtonId,
                    }],
                    leftButtonColor: changeOpacity(theme.centerChannelColor, 0.56),
                    background: {
                        color: theme.centerChannelBg,
                    },
                    title: {
                        color: theme.centerChannelColor,
                    },
                },
            });
        } else {
            showModalOverCurrentContext(Screens.BOTTOM_SHEET, {
                renderContent,
                snapPoints: [height, 10],
            }, {swipeToDismiss: true});
        }
    }), [canCreateTeams, otherTeams, isTablet, theme]);

    return (
        <View style={styles.container}>
            <TouchableWithFeedback
                onPress={onPress}
                type='opacity'
                style={styles.touchable}
            >
                <CompassIcon
                    size={28}
                    name='plus'
                    color={changeOpacity(theme.buttonColor, 0.64)}
                />
            </TouchableWithFeedback>
        </View>
    );
}

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        container: {
            flex: 0,
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.64),
            borderRadius: 10,
            height: 48,
            width: 48,
            marginTop: 6,
            marginBottom: 12,
            marginHorizontal: 12,
            overflow: 'hidden',
        },
        touchable: {
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
        },
    };
});