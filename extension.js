// -*- Javascript -*-
/*
    ------------------------------------------------------------------------------------------------

    File: src/extension.js.in

    Copyright 🄯 2022, 2023 Van de Bugger.

    This file is part of Agism.

    Agism is free software: you can redistribute it and/or modify it under the terms of the GNU
    General Public License as published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    Agism is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
    the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
    General Public License for more details.

    You should have received a copy of the GNU General Public License along with Agism. If not, see
    <https://www.gnu.org/licenses/>.

    SPDX-License-Identifier: GPL-3.0-or-later

    ------------------------------------------------------------------------------------------------
*/

'use strict';

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {getInputSourceManager} from 'resource:///org/gnome/shell/ui/status/keyboard.js';

// -------------------------------------------------------------------------------------------------
// Agism class.
// -------------------------------------------------------------------------------------------------

const Interface = `
    <?xml version="1.0" encoding="UTF-8" ?>
    <node>
        <interface name="io.sourceforge.Agism">
            <property access="read" type="(ussss)"  name="CurrentSource"/>
            <property access="read" type="a(ussss)" name="InputSources" />
            <method name="ActivateInputSource">
                <arg direction="in"  type="u" name="index"      />
                <arg direction="in"  type="b" name="interactive"/>
                <arg direction="in"  type="s" name="bell"       />
                <arg direction="out" type="b" name="result"     />
            </method>
            <method name="GetCurrentSource">
                <arg direction="out" type="(ussss)"  name="result"/>
            </method>
            <method name="GetInputSources">
                <arg direction="out" type="a(ussss)" name="result"/>
            </method>
        </interface>
    </node>
`;
const Path = '/org/gnome/Shell/Extensions/Agism';

export default class Agism extends Extension {

    // Enable Input Source Manager: export it on the D-Bus.
    enable() {
        if ( ! this._dbus ) {
            this._dbus = Gio.DBusExportedObject.wrapJSObject( Interface, this );
        };
        this._ism = getInputSourceManager();
        this._on_current_source_changed =
            this._ism.connect(
                'current-source-changed',
                this._on_change.bind( this, 'CurrentSource' )
            );
        this._on_input_sources_changed =
            this._ism.connect(
                'sources-changed',
                this._on_change.bind( this, 'InputSources' )
            );
        this._dbus.export( Gio.DBus.session, Path );
    }; // enable

    // Disable Input Source Manager: unexport it on the D-Bus.
    disable() {
        this.ActivateInputSource( 0, false, '' );
        if ( this._dbus ) {
            /*
                GNOME Shell disables all extensions each time the screen is locked, so Agism will
                *not* work when GNOME Shell asks the user for a password to unlock the screen.
                Let's activate the first input source (presumable it is a default layout) just
                before disabling the Agism, so user can enter the password.
            */
            this._dbus.unexport();
            this._dbus = null;
        };
        if ( this._on_input_sources_changed ) {
            this._ism.disconnect( this._on_input_sources_changed );
            this._on_input_sources_changed = null;
        };
        if ( this._on_current_source_changed ) {
            this._ism.disconnect( this._on_current_source_changed );
            this._on_current_source_changed = null;
        };
    }; // disable

    // Returns array of the given input source properties.
    tuple( s ) {
        return [ s.index, s.id, s.shortName, s.displayName, s.type ];
    }; // tuple

    // This method converts GLib signals to D-Bus signals.
    _on_change( name ) {
        if ( this._dbus ) {
            const signature = this._dbus.get_info().lookup_property( name ).signature;
            const value = new GLib.Variant( signature, this[ name ] );
            this._dbus.emit_property_changed( name, value );
        };
    };

    // D-Bus property: Returns array of the input sources.
    get InputSources() {
        let result = [];
        const sources = this._ism.inputSources;
        for ( let i in sources ) {
            const s = sources[ i ];
            result[ s.index ] = this.tuple( s );
        };
        return result;
    }; // InputSources

    // D-Bus property: Returns the current input source.
    get CurrentSource() {
        return this.tuple( this._ism.currentSource );
    }; // CurrentSource

    // D-Bus method: Returns array of input sources.
    GetInputSources() {
        return this.InputSources;
    }; // GetInputSources

    // D-Bus method: Returns the current input source.
    GetCurrentSource() {
        return this.CurrentSource;
    }; // GetCurrentSource

    // D-Bus method: Activates input source with the given index.
    ActivateInputSource( index, interactive, bell ) {
        const sources = this._ism.inputSources;
        if ( index in sources ) {
            this._ism.activateInputSource( sources[ index ], interactive );
            if ( bell ) {
                const player = global.display.get_sound_player();
                player.play_from_theme( bell, 'Keyboard layout activated', null );
            };
            return true;
        } else {
            return false;
        };
    }; // ActivateInputSource

}; // Agism

// end of file //
