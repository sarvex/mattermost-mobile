// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Model, {Associations} from '@nozbe/watermelondb/Model';
import {field, json} from '@nozbe/watermelondb/decorators';

import {MM_TABLES} from '@constants/database';

const {CHANNEL, POST} = MM_TABLES.SERVER;

/**
 * The Draft model represents  the draft state of messages in Direct/Group messages and in channels
 */
export default class Draft extends Model {
    /** table (entity name) : Draft */
    static table = MM_TABLES.SERVER.DRAFT;

    /** associations : Describes every relationship to this entity. */
    static associations: Associations = {

        /** A DRAFT can belong to only one CHANNEL  */
        [CHANNEL]: {type: 'belongs_to', key: 'channel_id'},

        /** A DRAFT is associated to only one POST */
        [POST]: {type: 'belongs_to', key: 'root_id'},
    };

    /** channel_id : The foreign key pointing to the channel in which the draft was made */
    @field('channel_id') channelId: string | undefined;

    /** message : The draft message */
    @field('message') message: string | undefined;

    /** root_id : The root_id will be null for Direct Message and have a value for draft replies of a thread */
    @field('root_id') rootId: string | undefined;

    /** files : The files field will hold an array of files object that have not yet been uploaded and persisted within the FILE entity */
    @json('files', (rawJson) => rawJson) files: string[] | undefined;
}