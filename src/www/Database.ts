/*
   Copyright 2022 Total Pave Inc.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

import {IDatabaseHandle} from './IDatabaseHandle';

export class Database implements IDatabaseHandle {
    private $handle: string;
    private $closed: boolean;

    public constructor(handle: string) {
        this.$handle = handle;
        this.$closed = false;
    }

    public getHandle(): string {
        return this.$handle;
    }

    public isClosed(): boolean {
        return this.$closed;
    }

    public __close(): void {
        this.$closed = true;
    }
}
