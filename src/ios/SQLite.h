
#import <Cordova/CDVPlugin.h>

@interface SQLite : CDVPlugin

-(void)open:(CDVInvokedUrlCommand *)command;
-(void)query:(CDVInvokedUrlCommand *)command;
-(void)close:(CDVInvokedUrlCommand *)command;
-(void)backup:(CDVInvokedUrlCommand *)command;
-(void)restoreBackup:(CDVInvokedUrlCommand *)command;
// -(void)getLogs:(CDVInvokedUrlCommand *)command;

@end
