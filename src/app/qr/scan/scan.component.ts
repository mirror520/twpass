import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { isNationalIdentificationNumberValid } from 'taiwan-id-validator';

import { RsaService } from '../rsa.service';
import { UserService } from '../../user/user.service';
import { Result } from '../../model/result';
import { User } from '../../user/model/user';
import { Guest } from 'src/app/user/model/guest';
import { Token } from '../../user/model/token';
import { Visit } from '../models/visit';
import { Location } from '../models/location';
import { GuestRegisterDialogComponent } from './guest-register-dialog/guest-register-dialog.component';
import { ScanSuccessDialogComponent } from './scan-success-dialog/scan-success-dialog.component';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.component.html',
  styleUrls: ['./scan.component.scss']
})
export class ScanComponent implements OnInit {
  private _ciphertext: string;
  private _currentLocation: Location;
  private _currentDevice: MediaDeviceInfo = null;

  availableDevices: MediaDeviceInfo[];

  locations: Observable<Location[]>;
  scanEnabled = true;

  constructor(
    private dialog: MatDialog,
    private rsaService: RsaService,
    private userService: UserService,
    private snackBar: MatSnackBar,
  ) { }

  ngOnInit() {
    this.rsaService.getTodayPrivkey().subscribe({
      next: (value) => this.rsaService.privkey = value.data,
      error: (err) => this.faultHandler(err),
      complete: () => console.log('complete')
    });

    this.locations = this.rsaService.getLocations();
  }

  visit(username: string) {
    let locationID = 0;
    if (this.currentLocation)
      locationID = this.currentLocation.id

    this.rsaService.visit(username, locationID).subscribe({
      next: (value) => this.visitResultHandler(value),
      error: (err) => this.faultHandler(err),
    });
  }

  scanSuccessHandler(result: string) {
    if (!this.scanEnabled)
      return;

    let username: string;
    let success = false;

    if (isNationalIdentificationNumberValid(result)) {
      username = result;
      success = true;
    }

    const user = this.rsaService.decrypt(result);
    if (user) {
      let info = user.split(",")
      username = info[1];
      success = true;
    }

    if ((success) && (this.scanEnabled)) {
      this.scanEnabled = false;
      this.visit(username);
    }
  }

  private visitResultHandler(result: Result<Visit>) {
    const visit: Visit = Object.assign(new Visit(), result.data);

    const dialogRef = this.dialog.open(ScanSuccessDialogComponent, {
      width: '80%',
      maxWidth: '600px',
      data: visit
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      this.scanEnabled = true;
    });
  }

  private faultHandler(error: HttpErrorResponse) {
    const result: Result<any> = Object.assign(new Result(), error.error);
    const info = result.info[0]

    if (error.status === 401) {
      this.userService.refreshToken().subscribe({
        next: (value) => this.refreshTokenHandler(value),
        error: (err) => console.error(err),
        complete: () => console.log('complete')
      });
    }

    if (error.status === 409) {
      const guest = new Guest();
      guest.id_card = result.data;

      const dialogRef = this.dialog.open(GuestRegisterDialogComponent, {
        width: '80%',
        maxWidth: '600px',
        data: guest
      });

      dialogRef.afterClosed().subscribe((user: User) => {
        this.scanEnabled = true;

        if (user) {
          this.scanEnabled = false;
          this.visit(user.username);

          this.snackBar.open(`${user.name} 已經完成資料登錄`, '確定', {
            duration: 2000
          });
        }
      });
    }

    if (error.status === 422) {

    }

    this.snackBar.open(info, '確定', {
      duration: 2000
    });
  }

  private refreshTokenHandler(result: Result<Token>) {
    const token: Token = Object.assign(new Token(), result.data);
    this.userService.currentUser.token = token;
  }

  onCamerasFound(devices: MediaDeviceInfo[]): void {
    this.availableDevices = devices;
  }

  set ciphertext(value: string) {
    this._ciphertext = value;
  }

  get ciphertext(): string {
    return this._ciphertext;
  }

  public get currentUser(): User {
    return this.userService.currentUser;
  }

  public get currentLocation(): Location {
    return this._currentLocation;
  }
  public set currentLocation(value: Location) {
    this._currentLocation = value;
  }

  public get currentDevice(): MediaDeviceInfo {
    return this._currentDevice;
  }
  public set currentDevice(value: MediaDeviceInfo) {
    if (value == null)
      return;

    this._currentDevice = value;
  }
}
